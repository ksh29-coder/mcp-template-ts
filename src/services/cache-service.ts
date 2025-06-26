import { promises as fs } from 'fs';
import path from 'path';
import { JavaClass, MavenDependency, MavenProject } from '../models/types.js';

/**
 * Service for caching analyzed data to improve performance
 */
export class CacheService {
  private cacheDir: string;
  private pomCache: Map<string, MavenProject> = new Map();
  private jarCache: Map<string, JavaClass[]> = new Map();
  private dependencyTreeCache: Map<string, MavenDependency[]> = new Map();
  private sourceCodeCache: Map<string, string> = new Map();
  private javadocCache: Map<string, string> = new Map();
  private cacheEnabled = true;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.env.HOME || '', '.maven-api-explorer', 'cache');
    this.initCache();
  }

  /**
   * Initialize the cache directory
   */
  private async initCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Try to load persisted cache on startup
      await this.loadPersistedCache();
      
      console.log(`Cache initialized at ${this.cacheDir}`);
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to initialize cache: ${error.message}`);
      this.cacheEnabled = false;
    }
  }

  /**
   * Load persisted cache data from disk
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      // Load POM cache
      const pomCachePath = path.join(this.cacheDir, 'pom-cache.json');
      try {
        const pomCacheData = await fs.readFile(pomCachePath, 'utf-8');
        const pomCacheEntries = JSON.parse(pomCacheData);
        for (const [key, value] of Object.entries(pomCacheEntries)) {
          this.pomCache.set(key, value as MavenProject);
        }
        console.log(`Loaded ${this.pomCache.size} POM cache entries`);
      } catch (error) {
        // It's okay if the cache doesn't exist yet
      }

      // Load dependency tree cache
      const depTreeCachePath = path.join(this.cacheDir, 'dependency-tree-cache.json');
      try {
        const depTreeCacheData = await fs.readFile(depTreeCachePath, 'utf-8');
        const depTreeCacheEntries = JSON.parse(depTreeCacheData);
        for (const [key, value] of Object.entries(depTreeCacheEntries)) {
          this.dependencyTreeCache.set(key, value as MavenDependency[]);
        }
        console.log(`Loaded ${this.dependencyTreeCache.size} dependency tree cache entries`);
      } catch (error) {
        // It's okay if the cache doesn't exist yet
      }

      // Load JAR analysis cache index
      const jarCacheIndexPath = path.join(this.cacheDir, 'jar-cache-index.json');
      try {
        const jarCacheIndex = await fs.readFile(jarCacheIndexPath, 'utf-8');
        const jarCacheEntries = JSON.parse(jarCacheIndex) as { key: string, filePath: string }[];
        
        // Load each JAR cache file
        for (const entry of jarCacheEntries) {
          try {
            const jarCacheData = await fs.readFile(entry.filePath, 'utf-8');
            this.jarCache.set(entry.key, JSON.parse(jarCacheData) as JavaClass[]);
          } catch (error) {
            // Skip this entry if it can't be loaded
          }
        }
        console.log(`Loaded ${this.jarCache.size} JAR cache entries`);
      } catch (error) {
        // It's okay if the cache doesn't exist yet
      }
    } catch (error) {
      console.warn('Failed to load persisted cache, starting with empty cache');
    }
  }

  /**
   * Persist cache data to disk
   */
  async persistCache(): Promise<void> {
    if (!this.cacheEnabled) return;
    
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Persist POM cache
      const pomCacheObj: Record<string, MavenProject> = {};
      for (const [key, value] of this.pomCache.entries()) {
        pomCacheObj[key] = value;
      }
      const pomCachePath = path.join(this.cacheDir, 'pom-cache.json');
      await fs.writeFile(pomCachePath, JSON.stringify(pomCacheObj));
      
      // Persist dependency tree cache
      const depTreeCacheObj: Record<string, MavenDependency[]> = {};
      for (const [key, value] of this.dependencyTreeCache.entries()) {
        depTreeCacheObj[key] = value;
      }
      const depTreeCachePath = path.join(this.cacheDir, 'dependency-tree-cache.json');
      await fs.writeFile(depTreeCachePath, JSON.stringify(depTreeCacheObj));
      
      // Persist JAR cache
      const jarCacheDir = path.join(this.cacheDir, 'jar-cache');
      await fs.mkdir(jarCacheDir, { recursive: true });
      
      const jarCacheIndex: { key: string, filePath: string }[] = [];
      
      for (const [key, value] of this.jarCache.entries()) {
        const safeKey = key.replace(/[/:]/g, '_');
        const jarCacheFilePath = path.join(jarCacheDir, `${safeKey}.json`);
        await fs.writeFile(jarCacheFilePath, JSON.stringify(value));
        jarCacheIndex.push({ key, filePath: jarCacheFilePath });
      }
      
      const jarCacheIndexPath = path.join(this.cacheDir, 'jar-cache-index.json');
      await fs.writeFile(jarCacheIndexPath, JSON.stringify(jarCacheIndex));
      
      console.log('Cache persisted to disk');
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to persist cache: ${error.message}`);
    }
  }

  /**
   * Get cached Maven project data
   */
  getCachedPom(pomPath: string): MavenProject | undefined {
    return this.pomCache.get(pomPath);
  }

  /**
   * Cache Maven project data
   */
  cachePom(pomPath: string, project: MavenProject): void {
    if (!this.cacheEnabled) return;
    
    this.pomCache.set(pomPath, project);
    this.scheduleAutoPersist();
  }

  /**
   * Get cached dependency tree
   */
  getCachedDependencyTree(pomPath: string): MavenDependency[] | undefined {
    return this.dependencyTreeCache.get(pomPath);
  }

  /**
   * Cache dependency tree
   */
  cacheDependencyTree(pomPath: string, dependencies: MavenDependency[]): void {
    if (!this.cacheEnabled) return;
    
    this.dependencyTreeCache.set(pomPath, dependencies);
    this.scheduleAutoPersist();
  }

  /**
   * Get cached JAR analysis
   */
  getCachedJarAnalysis(dependency: MavenDependency): JavaClass[] | undefined {
    const key = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
    return this.jarCache.get(key);
  }

  /**
   * Cache JAR analysis
   */
  cacheJarAnalysis(dependency: MavenDependency, classes: JavaClass[]): void {
    if (!this.cacheEnabled) return;
    
    const key = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
    this.jarCache.set(key, classes);
    this.scheduleAutoPersist();
  }

  /**
   * Get cached source code
   */
  getCachedSourceCode(filename: string): string | undefined {
    return this.sourceCodeCache.get(filename);
  }

  /**
   * Cache source code
   */
  cacheSourceCode(filename: string, source: string): void {
    if (!this.cacheEnabled) return;
    
    this.sourceCodeCache.set(filename, source);
  }

  /**
   * Get cached javadoc
   */
  getCachedJavadoc(className: string): string | undefined {
    return this.javadocCache.get(className);
  }

  /**
   * Cache javadoc
   */
  cacheJavadoc(className: string, javadoc: string): void {
    if (!this.cacheEnabled) return;
    
    this.javadocCache.set(className, javadoc);
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.pomCache.clear();
    this.jarCache.clear();
    this.dependencyTreeCache.clear();
    this.sourceCodeCache.clear();
    this.javadocCache.clear();
    
    // Clear persisted cache
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('Cache cleared');
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to clear cache: ${error.message}`);
    }
  }

  // Auto-persist the cache after a certain period of inactivity
  private persistTimeoutId: NodeJS.Timeout | null = null;
  private scheduleAutoPersist(): void {
    if (this.persistTimeoutId) {
      clearTimeout(this.persistTimeoutId);
    }
    
    this.persistTimeoutId = setTimeout(() => {
      this.persistCache();
      this.persistTimeoutId = null;
    }, 30000); // 30 seconds
  }
}