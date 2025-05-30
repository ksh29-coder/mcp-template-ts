import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import JSZip from 'jszip';
import { JavaClass, JavaParameter, MavenDependency } from '../models/types.js';

export class JarAnalyzer {
  private mavenRepoUrl: string;
  private localRepoPath: string;
  private classCache: Map<string, JavaClass> = new Map();

  constructor(localRepoPath?: string, mavenRepoUrl?: string) {
    this.mavenRepoUrl = mavenRepoUrl || 'https://repo1.maven.org/maven2';
    this.localRepoPath = localRepoPath || path.join(process.env.HOME || '', '.m2', 'repository');
  }

  /**
   * Analyze a JAR file and extract class information
   */
  async analyzeJar(dependency: MavenDependency): Promise<JavaClass[]> {
    const jarPath = this.buildLocalJarPath(dependency);
    let jarBuffer: Buffer;

    try {
      // Try to read from local Maven repository
      jarBuffer = await fs.readFile(jarPath);
    } catch (error) {
      // If not found locally, fetch from Maven Central
      console.log(`Fetching JAR for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
      const jarUrl = this.buildMavenRepoJarUrl(dependency);
      const response = await fetch(jarUrl);
      
      if (!response.ok) {
        throw new Error(`Could not fetch JAR: ${response.statusText}`);
      }
      
      jarBuffer = Buffer.from(await response.arrayBuffer());
      
      // Save to local repo for future use
      await this.saveToLocalRepo(dependency, jarBuffer);
    }

    // Also try to fetch sources and javadoc JARs
    await this.fetchSourcesJar(dependency);
    await this.fetchJavadocJar(dependency);

    // Parse the JAR file
    return this.parseJarFile(jarBuffer, dependency);
  }

  /**
   * Parse JAR file and extract class information
   */
  private async parseJarFile(jarBuffer: Buffer, dependency: MavenDependency): Promise<JavaClass[]> {
    const classes: JavaClass[] = [];
    const zip = await JSZip.loadAsync(jarBuffer);

    // Process each file in the JAR
    for (const [filename, _file] of Object.entries(zip.files)) {
      // Only process .class files
      if (!filename.endsWith('.class') || filename.includes('$')) {
        continue;
      }

      try {
        // For a full implementation, we would use a Java bytecode parser like ASM
        // But for this proof of concept, we'll create a stub representation
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

        // Try to find corresponding source file to extract more information
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
    try {
      const jarBuffer = await fs.readFile(jarPath);
      const zip = await JSZip.loadAsync(jarBuffer);
      const file = zip.file(filePath);
      
      if (!file) {
        return null;
      }
      
      return await file.async('string');
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
    // For a full implementation, we would use a proper HTML parser like Cheerio
    // For this proof of concept, we'll just extract the class description
    const classDescMatch = javadocContent.match(/<div class="block">([\s\S]*?)<\/div>/);
    if (classDescMatch) {
      classInfo.javadoc = classDescMatch[1].trim()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    }
  }

  /**
   * Extract class name from class file path
   */
  private classNameFromPath(filePath: string): string {
    const fileName = path.basename(filePath);
    return fileName.slice(0, -6); // Remove .class extension
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
   * Fetch sources JAR for a dependency
   */
  private async fetchSourcesJar(dependency: MavenDependency): Promise<void> {
    const sourcesJarPath = this.buildLocalSourcesJarPath(dependency);
    
    try {
      // Check if it exists locally
      await fs.access(sourcesJarPath);
      return; // Already exists
    } catch (error) {
      // Need to fetch it
      const sourcesJarUrl = this.buildMavenRepoSourcesJarUrl(dependency);
      
      try {
        const response = await fetch(sourcesJarUrl);
        if (!response.ok) {
          console.log(`Sources JAR not found for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
          return;
        }
        
        const jarBuffer = Buffer.from(await response.arrayBuffer());
        
        // Save to local repo
        await fs.mkdir(path.dirname(sourcesJarPath), { recursive: true });
        await fs.writeFile(sourcesJarPath, jarBuffer);
        console.log(`Downloaded sources JAR for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
      } catch (err) {
        const error = err as Error;
        console.warn(`Error fetching sources JAR:`, error.message);
      }
    }
  }

  /**
   * Fetch Javadoc JAR for a dependency
   */
  private async fetchJavadocJar(dependency: MavenDependency): Promise<void> {
    const javadocJarPath = this.buildLocalJavadocJarPath(dependency);
    
    try {
      // Check if it exists locally
      await fs.access(javadocJarPath);
      return; // Already exists
    } catch (error) {
      // Need to fetch it
      const javadocJarUrl = this.buildMavenRepoJavadocJarUrl(dependency);
      
      try {
        const response = await fetch(javadocJarUrl);
        if (!response.ok) {
          console.log(`Javadoc JAR not found for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
          return;
        }
        
        const jarBuffer = Buffer.from(await response.arrayBuffer());
        
        // Save to local repo
        await fs.mkdir(path.dirname(javadocJarPath), { recursive: true });
        await fs.writeFile(javadocJarPath, jarBuffer);
        console.log(`Downloaded javadoc JAR for ${dependency.groupId}:${dependency.artifactId}:${dependency.version}`);
      } catch (err) {
        const error = err as Error;
        console.warn(`Error fetching javadoc JAR:`, error.message);
      }
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