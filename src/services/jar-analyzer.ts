import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import JSZip from 'jszip';
import { JavaClass, JavaParameter, MavenDependency } from '../models/types.js';
import { CacheService } from './cache-service.js';
import { UserInteractionService } from './user-interaction.js';

export class JarAnalyzer {
  private mavenRepoUrl: string;
  private localRepoPath: string;
  private classCache: Map<string, JavaClass> = new Map();
  private cacheService?: CacheService;
  private userInteraction: UserInteractionService;
  private offlineMode: boolean = false;

  constructor(localRepoPath?: string, mavenRepoUrl?: string, cacheService?: CacheService) {
    this.mavenRepoUrl = mavenRepoUrl || 'https://repo1.maven.org/maven2';
    this.localRepoPath = localRepoPath || path.join(process.env.HOME || '', '.m2', 'repository');
    this.cacheService = cacheService;
    this.userInteraction = new UserInteractionService();
  }

  /**
   * Close the user interaction service
   */
  close(): void {
    this.userInteraction.close();
  }

  /**
   * Set offline mode
   */
  setOfflineMode(offline: boolean): void {
    this.offlineMode = offline;
  }

  /**
   * Analyze a JAR file and extract class information
   */
  async analyzeJar(dependency: MavenDependency): Promise<JavaClass[]> {
    // Check cache first
    if (this.cacheService) {
      const cachedClasses = this.cacheService.getCachedJarAnalysis(dependency);
      if (cachedClasses) {
        console.log(`Using cached JAR analysis for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
        return cachedClasses;
      }
    }
    
    const dependencyName = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
    const jarPath = this.buildLocalJarPath(dependency);
    const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
    
    // Check what's available locally
    const mainJarExists = await this.fileExists(jarPath);
    const sourcesJarExists = await this.fileExists(sourcesJarPath);
    
    let jarBuffer: Buffer;
    let useSourcesJar = false;
    
    if (mainJarExists) {
      // Main JAR available locally - use it
      jarBuffer = await fs.readFile(jarPath);
      console.log(`✅ Using local main JAR: ${jarPath}`);
    } else if (sourcesJarExists) {
      // Sources JAR available locally - use it  
      jarBuffer = await fs.readFile(sourcesJarPath);
      useSourcesJar = true;
      console.log(`✅ Using local sources JAR: ${sourcesJarPath}`);
    } else {
      // Neither available locally - ask user what to do
      if (this.offlineMode) {
        throw new Error(`Dependency ${dependencyName} not available locally and offline mode is enabled`);
      }
      
      try {
        const choice = await this.userInteraction.promptForMissingDependency(
          dependency.groupId,
          dependency.artifactId,
          dependency.version
        );
        
        if (choice.type === 'skip') {
          throw new Error(`User chose to skip dependency: ${dependencyName}`);
        }
        
        // Download based on user choice
        const downloadResult = await this.downloadDependency(dependency, choice.type);
        jarBuffer = downloadResult.buffer;
        useSourcesJar = downloadResult.isSourcesJar;
        
      } catch (error) {
        if ((error as Error).message === 'OFFLINE_MODE') {
          this.offlineMode = true;
          throw new Error(`Entered offline mode. Dependency ${dependencyName} not available locally.`);
        }
        throw error;
      }
    }

    // Also try to fetch sources and javadoc JARs if not already present
    if (!useSourcesJar && !sourcesJarExists) {
      await this.ensureSourcesJar(dependency);
    }
    await this.ensureJavadocJar(dependency);

    // Parse the JAR file (handle sources JAR differently)
    const classes = await this.parseJarFile(jarBuffer, dependency, useSourcesJar);
    
    // Cache the result
    if (this.cacheService) {
      this.cacheService.cacheJarAnalysis(dependency, classes);
    }
    
    return classes;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download dependency based on user choice
   */
  private async downloadDependency(
    dependency: MavenDependency, 
    type: 'main' | 'sources' | 'both'
  ): Promise<{ buffer: Buffer; isSourcesJar: boolean }> {
    if (type === 'both') {
      // Download both, prefer sources for analysis
      await this.downloadWithConfirmation(dependency, 'sources');
      await this.downloadWithConfirmation(dependency, 'main');
      
      const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
      const buffer = await fs.readFile(sourcesJarPath);
      return { buffer, isSourcesJar: true };
    } else {
      // Download single type
      await this.downloadWithConfirmation(dependency, type);
      
      if (type === 'sources') {
        const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
        const buffer = await fs.readFile(sourcesJarPath);
        return { buffer, isSourcesJar: true };
      } else {
        const jarPath = this.buildLocalJarPath(dependency);
        const buffer = await fs.readFile(jarPath);
        return { buffer, isSourcesJar: false };
      }
    }
  }

  /**
   * Download a specific JAR type with user confirmation
   */
  private async downloadWithConfirmation(
    dependency: MavenDependency,
    type: 'main' | 'sources'
  ): Promise<void> {
    const dependencyName = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
    
    // Ask for confirmation
    const confirmed = await this.userInteraction.confirmDownload(type, dependencyName);
    if (!confirmed) {
      throw new Error(`User cancelled download of ${type} JAR for ${dependencyName}`);
    }
    
    this.userInteraction.showDownloadProgress(dependencyName, type, 'starting');
    
    try {
      if (type === 'sources') {
        await this.downloadSourcesJar(dependency);
      } else {
        await this.downloadMainJar(dependency);
      }
      
      this.userInteraction.showDownloadProgress(dependencyName, type, 'completed');
    } catch (error) {
      this.userInteraction.showDownloadProgress(dependencyName, type, 'failed');
      throw error;
    }
  }

  /**
   * Download main JAR
   */
  private async downloadMainJar(dependency: MavenDependency): Promise<void> {
    const jarUrl = this.buildMavenRepoJarUrl(dependency);
    const response = await fetch(jarUrl);
    
    if (!response.ok) {
      throw new Error(`Could not fetch main JAR from ${jarUrl}: ${response.statusText}`);
    }
    
    const jarBuffer = Buffer.from(await response.arrayBuffer());
    await this.saveToLocalRepo(dependency, jarBuffer);
  }

  /**
   * Download sources JAR
   */
  private async downloadSourcesJar(dependency: MavenDependency): Promise<void> {
    const sourcesUrl = this.buildMavenRepoSourcesJarUrl(dependency);
    const response = await fetch(sourcesUrl);
    
    if (!response.ok) {
      throw new Error(`Could not fetch sources JAR from ${sourcesUrl}: ${response.statusText}`);
    }
    
    const sourcesBuffer = Buffer.from(await response.arrayBuffer());
    await this.saveSourcesJarToLocalRepo(dependency, sourcesBuffer);
  }

  /**
   * Ensure sources JAR is available (ask user if not)
   */
  private async ensureSourcesJar(dependency: MavenDependency): Promise<void> {
    const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
    const exists = await this.fileExists(sourcesJarPath);
    
    if (!exists && !this.offlineMode) {
      const dependencyName = `${dependency.groupId}:${dependency.artifactId}:${dependency.version}`;
      const shouldDownload = await this.userInteraction.promptForLimitedAnalysis(
        dependencyName,
        'Main JAR only (no source code for enhanced analysis)'
      );
      
      if (shouldDownload) {
        try {
          await this.downloadWithConfirmation(dependency, 'sources');
        } catch (error) {
          console.error(`Failed to download sources JAR: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Ensure javadoc JAR is available (optional, no prompts)
   */
  private async ensureJavadocJar(dependency: MavenDependency): Promise<void> {
    const javadocJarPath = this.buildLocalJavadocJarPath(dependency);
    const exists = await this.fileExists(javadocJarPath);
    
    if (!exists && !this.offlineMode) {
      try {
        await this.fetchJavadocJar(dependency);
      } catch (error) {
        // Javadoc is optional, don't fail if not available
      }
    }
  }

  /**
   * Save sources JAR to local repository
   */
  private async saveSourcesJarToLocalRepo(dependency: MavenDependency, content: Buffer): Promise<void> {
    const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
    
    try {
      await fs.mkdir(path.dirname(sourcesJarPath), { recursive: true });
      await fs.writeFile(sourcesJarPath, content);
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to save sources JAR to local repository: ${error.message}`);
    }
  }

  /**
   * Parse JAR file and extract class information
   */
  private async parseJarFile(jarBuffer: Buffer, dependency: MavenDependency, isSourcesJar: boolean = false): Promise<JavaClass[]> {
    const classes: JavaClass[] = [];
    const zip = await JSZip.loadAsync(jarBuffer);

    // Process each file in the JAR
    for (const [filename, file] of Object.entries(zip.files)) {
      if (isSourcesJar) {
        // For sources JAR, process .java files
        if (!filename.endsWith('.java') || filename.includes('$') || file.dir) {
          continue;
        }
      } else {
        // For regular JAR, process .class files
        if (!filename.endsWith('.class') || filename.includes('$') || file.dir) {
          continue;
        }
      }

      try {
        const className = this.classNameFromPath(filename);
        const packageName = this.packageNameFromPath(filename);
        
        const classInfo: JavaClass = {
          name: className,
          packageName: packageName,
          isInterface: false,
          isAbstract: false,
          modifiers: ['public'],
          methods: [],
          fields: [],
          interfaces: [],
        };

        if (isSourcesJar) {
          // For sources JAR, directly parse the Java source file
          const sourceContent = await file.async('string');
          if (sourceContent) {
            this.enrichClassInfoFromSource(classInfo, sourceContent);
          }
        } else {
          // For regular JAR, try to find corresponding source file to extract more information
          const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
          try {
            const sourcePath = filename.replace('.class', '.java');
            const sourceContent = await this.extractFileFromJar(sourcesJarPath, sourcePath);
            if (sourceContent) {
              this.enrichClassInfoFromSource(classInfo, sourceContent);
            }
          } catch (error) {
            // Source not available, that's fine
          }
        }

        // Try to find javadoc for this class
        const javadocJarPath = this.buildLocalJavadocJarPath(dependency);
        try {
          const javadocPath = `${packageName.replace(/\\./g, '/')}/${className}.html`;
          const javadocContent = await this.extractFileFromJar(javadocJarPath, javadocPath);
          if (javadocContent) {
            this.enrichClassInfoFromJavadoc(classInfo, javadocContent);
          }
        } catch (error) {
          // Javadoc not available, that's fine
        }

        classes.push(classInfo);
        this.classCache.set(`${packageName}.${className}`, classInfo);
      } catch (err) {
        const error = err as Error;
        console.warn(`Error processing class file ${filename}:`, error.message);
      }
    }

    return classes;
  }

  /**
   * Extract a file from a JAR
   */
  private async extractFileFromJar(jarPath: string, filePath: string): Promise<string | null> {
    // Check source code cache first
    if (this.cacheService) {
      const cacheKey = `${jarPath}:${filePath}`;
      const cachedContent = this.cacheService.getCachedSourceCode(cacheKey);
      if (cachedContent) {
        return cachedContent;
      }
    }
    
    try {
      const jarBuffer = await fs.readFile(jarPath);
      const zip = await JSZip.loadAsync(jarBuffer);
      const file = zip.file(filePath);
      
      if (!file) {
        return null;
      }
      
      const content = await file.async('string');
      
      // Cache the content
      if (this.cacheService && content) {
        const cacheKey = `${jarPath}:${filePath}`;
        this.cacheService.cacheSourceCode(cacheKey, content);
      }
      
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Enrich class info from source code
   */
  private enrichClassInfoFromSource(classInfo: JavaClass, sourceContent: string): void {
    // For a full implementation, we would parse the Java source code
    // and extract method signatures, comments, etc.
    // For this proof of concept, we'll just do some basic regex matching
    
    // Extract class modifiers and type
    const classMatch = sourceContent.match(/\b(public|protected|private)?\s*(abstract|final)?\s*(class|interface|enum)\s+(\w+)/);
    if (classMatch) {
      classInfo.modifiers = [];
      if (classMatch[1]) classInfo.modifiers.push(classMatch[1]);
      if (classMatch[2]) classInfo.modifiers.push(classMatch[2]);
      classInfo.isInterface = classMatch[3] === 'interface';
      classInfo.isAbstract = classMatch[2] === 'abstract' || classMatch[3] === 'interface';
    }

    // Extract method info using very basic regex (a real implementation would use a proper parser)
    const methodRegex = /\n\s*(\/\*\*([\s\S]*?)\*\/)?\s*\b(public|protected|private)?\s*(static|abstract|final|synchronized|native)?\s*(?:<.*?>)?\s*(\w+(?:<.*?>)?)\s+(\w+)\s*\((.*?)\)\s*(?:throws\s+([\w,\s]+))?\s*\{?/g;
    let match;
    while ((match = methodRegex.exec(sourceContent)) !== null) {
      const javadoc = match[1] ? match[1] : undefined;
      const modifiers = [];
      if (match[3]) modifiers.push(match[3]);
      if (match[4]) modifiers.push(match[4]);
      
      const returnType = match[5];
      const methodName = match[6];
      const paramsStr = match[7];
      const throwsStr = match[8];
      
      // Parse parameters
      const parameters: JavaParameter[] = [];
      if (paramsStr.trim()) {
        const params = paramsStr.split(',');
        for (const param of params) {
          const parts = param.trim().split(/\s+/);
          if (parts.length >= 2) {
            parameters.push({
              type: parts.slice(0, parts.length - 1).join(' '),
              name: parts[parts.length - 1]
            });
          }
        }
      }
      
      // Parse exceptions
      const exceptions = throwsStr ? throwsStr.split(',').map(e => e.trim()) : [];
      
      // Extract parameter descriptions from javadoc
      if (javadoc) {
        const paramMatches = [...javadoc.matchAll(/@param\s+(\w+)\s+(.*?)(?=\n\s*\*\s*@|\n\s*\*\/)/g)];
        for (const paramMatch of paramMatches) {
          const paramName = paramMatch[1];
          const paramDesc = paramMatch[2].trim();
          const param = parameters.find(p => p.name === paramName);
          if (param) {
            param.description = paramDesc;
          }
        }
      }
      
      classInfo.methods.push({
        name: methodName,
        returnType,
        parameters,
        modifiers,
        exceptions,
        javadoc: javadoc?.replace(/\*\//g, '').replace(/\/\*\*/g, '').replace(/\n\s*\*/g, '\n').trim()
      });
    }
    
    // Extract field info using basic regex
    const fieldRegex = /\n\s*(\/\*\*([\s\S]*?)\*\/)?\s*\b(public|protected|private)?\s*(static|final|volatile|transient)?\s*(\w+(?:<.*?>)?)\s+(\w+)\s*(?:=.+?)?;/g;
    while ((match = fieldRegex.exec(sourceContent)) !== null) {
      const javadoc = match[1] ? match[1] : undefined;
      const modifiers = [];
      if (match[3]) modifiers.push(match[3]);
      if (match[4]) modifiers.push(match[4]);
      
      const fieldType = match[5];
      const fieldName = match[6];
      
      classInfo.fields.push({
        name: fieldName,
        type: fieldType,
        modifiers,
        javadoc: javadoc?.replace(/\*\//g, '').replace(/\/\*\*/g, '').replace(/\n\s*\*/g, '\n').trim()
      });
    }
  }

  /**
   * Enrich class info from javadoc
   */
  private enrichClassInfoFromJavadoc(classInfo: JavaClass, javadocContent: string): void {
    // Check javadoc cache first
    const fullClassName = `${classInfo.packageName}.${classInfo.name}`;
    if (this.cacheService) {
      const cachedJavadoc = this.cacheService.getCachedJavadoc(fullClassName);
      if (cachedJavadoc) {
        classInfo.javadoc = cachedJavadoc;
        return;
      }
    }
    
    // For a full implementation, we would use a proper HTML parser like Cheerio
    // For this proof of concept, we'll just extract the class description
    const classDescMatch = javadocContent.match(/<div class="block">([\s\S]*?)<\/div>/);
    if (classDescMatch) {
      const javadoc = classDescMatch[1].trim()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      
      classInfo.javadoc = javadoc;
      
      // Cache the javadoc
      if (this.cacheService) {
        this.cacheService.cacheJavadoc(fullClassName, javadoc);
      }
    }
  }

  /**
   * Extract class name from class file path
   */
  private classNameFromPath(filePath: string): string {
    const fileName = path.basename(filePath);
    if (fileName.endsWith('.class')) {
      return fileName.slice(0, -6); // Remove .class extension
    } else if (fileName.endsWith('.java')) {
      return fileName.slice(0, -5); // Remove .java extension
    }
    return fileName;
  }

  /**
   * Extract package name from class file path
   */
  private packageNameFromPath(filePath: string): string {
    const dirPath = path.dirname(filePath);
    if (dirPath === '.' || dirPath === '/') {
      return '';
    }
    return dirPath.replace(/\//g, '.');
  }


  /**
   * Fetch Javadoc JAR for a dependency (silent, no user interaction)
   */
  private async fetchJavadocJar(dependency: MavenDependency): Promise<void> {
    const javadocJarPath = this.buildLocalJavadocJarPath(dependency);
    
    try {
      // Check if it exists locally
      const exists = await this.fileExists(javadocJarPath);
      if (exists) return; // Already exists
      
      // Try to fetch silently (javadoc is optional enhancement)
      const javadocJarUrl = this.buildMavenRepoJavadocJarUrl(dependency);
      
      const response = await fetch(javadocJarUrl);
      if (!response.ok) {
        // Javadoc not available, that's fine
        return;
      }
      
      const jarBuffer = Buffer.from(await response.arrayBuffer());
      
      // Save to local repo
      await fs.mkdir(path.dirname(javadocJarPath), { recursive: true });
      await fs.writeFile(javadocJarPath, jarBuffer);
      
    } catch (error) {
      // Javadoc is optional, don't log errors
    }
  }

  /**
   * Build path to local JAR file
   */
  private buildLocalJarPath(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return path.join(
      this.localRepoPath,
      groupPath,
      artifactId,
      version,
      `${artifactId}-${version}.jar`
    );
  }

  /**
   * Build path to local sources JAR file
   */
  private buildLocalSourcesJarPath(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return path.join(
      this.localRepoPath,
      groupPath,
      artifactId,
      version,
      `${artifactId}-${version}-sources.jar`
    );
  }

  /**
   * Build path to local javadoc JAR file
   */
  private buildLocalJavadocJarPath(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return path.join(
      this.localRepoPath,
      groupPath,
      artifactId,
      version,
      `${artifactId}-${version}-javadoc.jar`
    );
  }

  /**
   * Build URL to JAR file in Maven repository
   */
  private buildMavenRepoJarUrl(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return `${this.mavenRepoUrl}/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.jar`;
  }

  /**
   * Build URL to sources JAR file in Maven repository
   */
  private buildMavenRepoSourcesJarUrl(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return `${this.mavenRepoUrl}/${groupPath}/${artifactId}/${version}/${artifactId}-${version}-sources.jar`;
  }

  /**
   * Build URL to javadoc JAR file in Maven repository
   */
  private buildMavenRepoJavadocJarUrl(dependency: MavenDependency): string {
    const { groupId, artifactId, version } = dependency;
    const groupPath = groupId.replace(/\./g, '/');
    
    return `${this.mavenRepoUrl}/${groupPath}/${artifactId}/${version}/${artifactId}-${version}-javadoc.jar`;
  }

  /**
   * Save JAR file to local repository
   */
  private async saveToLocalRepo(dependency: MavenDependency, content: Buffer): Promise<void> {
    const jarPath = this.buildLocalJarPath(dependency);
    
    try {
      // Create directory structure if it doesn't exist
      await fs.mkdir(path.dirname(jarPath), { recursive: true });
      await fs.writeFile(jarPath, content);
    } catch (err) {
      const error = err as Error;
      console.warn(`Failed to save JAR to local repository: ${error.message}`);
    }
  }
}