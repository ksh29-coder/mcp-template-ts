import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { MavenDependency, MavenProject } from '../models/types.js';
import { CacheService } from './cache-service.js';

export class MavenParser {
  private mavenRepoUrl: string;
  private localRepoPath: string;
  private cacheService?: CacheService;

  constructor(localRepoPath?: string, mavenRepoUrl?: string, cacheService?: CacheService) {
    this.mavenRepoUrl = mavenRepoUrl || 'https://repo1.maven.org/maven2';
    this.localRepoPath = localRepoPath || path.join(process.env.HOME || '', '.m2', 'repository');
    this.cacheService = cacheService;
  }

  /**
   * Parse a pom.xml file and extract project information
   */
  async parsePom(pomPath: string): Promise<MavenProject> {
    try {
      // Check cache first
      if (this.cacheService) {
        const cachedProject = this.cacheService.getCachedPom(pomPath);
        if (cachedProject) {
          console.log(`Using cached POM data for ${pomPath}`);
          return cachedProject;
        }
      }
      
      const pomContent = await fs.readFile(pomPath, 'utf-8');
      const project = await this.parsePomContent(pomContent);
      
      // Cache the result
      if (this.cacheService) {
        this.cacheService.cachePom(pomPath, project);
      }
      
      return project;
    } catch (err) {
      const error = err as Error;
      console.error(`Error parsing POM file: ${pomPath}`, error);
      throw new Error(`Failed to parse POM file: ${error.message}`);
    }
  }

  /**
   * Parse POM XML content directly
   */
  async parsePomContent(pomContent: string): Promise<MavenProject> {
    try {
      const result = await parseStringPromise(pomContent, { explicitArray: false });
      const project = result.project;

      // Handle parent POM inheritance if needed
      if (project.parent) {
        // TODO: Fetch and merge with parent POM
      }

      const dependencies: MavenDependency[] = [];
      
      // Extract dependencies
      if (project.dependencies && project.dependencies.dependency) {
        const deps = Array.isArray(project.dependencies.dependency) 
          ? project.dependencies.dependency 
          : [project.dependencies.dependency];
        
        for (const dep of deps) {
          dependencies.push({
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            version: dep.version,
            scope: dep.scope,
            optional: dep.optional === 'true'
          });
        }
      }

      return {
        groupId: project.groupId || (project.parent && project.parent.groupId),
        artifactId: project.artifactId,
        version: project.version || (project.parent && project.parent.version),
        dependencies
      };
    } catch (err) {
      const error = err as Error;
      console.error('Error parsing POM content', error);
      throw new Error(`Failed to parse POM content: ${error.message}`);
    }
  }

  /**
   * Resolve the full dependency tree for a Maven project
   */
  async resolveDependencyTree(pomPath: string): Promise<MavenDependency[]> {
    // Check cache first
    if (this.cacheService) {
      const cachedDependencies = this.cacheService.getCachedDependencyTree(pomPath);
      if (cachedDependencies) {
        console.log(`Using cached dependency tree for ${pomPath}`);
        return cachedDependencies;
      }
    }
    
    const project = await this.parsePom(pomPath);
    const resolvedDeps: MavenDependency[] = [];
    const processedDeps = new Set<string>();

    for (const dep of project.dependencies) {
      await this.resolveDependency(dep, resolvedDeps, processedDeps);
    }
    
    // Cache the result
    if (this.cacheService) {
      this.cacheService.cacheDependencyTree(pomPath, resolvedDeps);
    }

    return resolvedDeps;
  }

  /**
   * Recursively resolve a dependency and its transitive dependencies
   */
  private async resolveDependency(
    dependency: MavenDependency, 
    resolvedDeps: MavenDependency[], 
    processedDeps: Set<string>
  ): Promise<void> {
    const depKey = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
    
    // Skip if already processed or if dependency is optional
    if (processedDeps.has(depKey) || dependency.optional) {
      return;
    }
    
    processedDeps.add(depKey);
    resolvedDeps.push(dependency);

    // Try to find dependency POM
    try {
      const depPomPath = this.buildLocalPomPath(dependency);
      let pomContent: string;

      try {
        // Try to read from local Maven repository
        pomContent = await fs.readFile(depPomPath, 'utf-8');
      } catch (error) {
        // If not found locally, fetch from Maven Central
        const pomUrl = this.buildMavenRepoPomUrl(dependency);
        const response = await fetch(pomUrl);
        
        if (!response.ok) {
          console.warn(`Could not fetch POM for ${depKey}: ${response.statusText}`);
          return;
        }
        
        pomContent = await response.text();
        
        // Save to local repo for future use
        await this.saveToLocalRepo(dependency, pomContent);
      }

      // Parse the dependency's POM
      const depProject = await this.parsePomContent(pomContent);
      
      // Process transitive dependencies
      if (depProject.dependencies) {
        for (const transitiveDep of depProject.dependencies) {
          // Skip provided/test dependencies
          if (transitiveDep.scope === 'provided' || transitiveDep.scope === 'test') {
            continue;
          }
          await this.resolveDependency(transitiveDep, resolvedDeps, processedDeps);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.warn(`Error resolving dependency ${depKey}:`, error.message);
    }
  }

  /**
   * Build path to local POM file
   */
  private buildLocalPomPath(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return path.join(
      this.localRepoPath,
      groupPath,
      artifactId,
      version,
      `${artifactId}-${version}.pom`
    );
  }

  /**
   * Build URL to POM file in Maven repository
   */
  private buildMavenRepoPomUrl(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return `${this.mavenRepoUrl}/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
  }

  /**
   * Save POM content to local repository
   */
  private async saveToLocalRepo(dependency: MavenDependency, content: string): Promise<void> {
    const pomPath = this.buildLocalPomPath(dependency);
    
    try {
      // Create directory structure if it doesn't exist
      await fs.mkdir(path.dirname(pomPath), { recursive: true });
      await fs.writeFile(pomPath, content, 'utf-8');
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to save POM to local repository: ${error.message}`);
    }
  }
}