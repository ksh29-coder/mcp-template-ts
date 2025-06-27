import { createInterface } from 'readline';

export interface DownloadOption {
  type: 'main' | 'sources' | 'both' | 'skip';
  description: string;
}

export class UserInteractionService {
  private readline = createInterface({
    input: process.stdin,
    output: process.stderr, // Use stderr to avoid interfering with MCP communication on stdout
  });

  /**
   * Ask user what to do when dependency JARs are missing locally
   */
  async promptForMissingDependency(
    groupId: string,
    artifactId: string,
    version: string
  ): Promise<DownloadOption> {
    const dependencyName = `${groupId}:${artifactId}:${version}`;
    
    console.error(`\n🔍 Dependency not found locally: ${dependencyName}`);
    console.error('What would you like to do?');
    console.error('1. Download sources JAR (recommended for analysis)');
    console.error('2. Download main JAR (compiled bytecode)');
    console.error('3. Download both JARs');
    console.error('4. Skip this dependency');
    console.error('5. Enter offline mode (skip all downloads)');
    
    const choice = await this.askQuestion('Enter your choice (1-5): ');
    
    switch (choice.trim()) {
      case '1':
        return { type: 'sources', description: 'Download sources JAR' };
      case '2':
        return { type: 'main', description: 'Download main JAR' };
      case '3':
        return { type: 'both', description: 'Download both JARs' };
      case '4':
        return { type: 'skip', description: 'Skip this dependency' };
      case '5':
        throw new Error('OFFLINE_MODE'); // Special error to trigger offline mode
      default:
        console.error('Invalid choice. Defaulting to sources JAR.');
        return { type: 'sources', description: 'Download sources JAR (default)' };
    }
  }

  /**
   * Ask user for confirmation before downloading
   */
  async confirmDownload(
    type: 'main' | 'sources' | 'both',
    dependencyName: string,
    estimatedSize?: string
  ): Promise<boolean> {
    const typeDesc = type === 'both' ? 'both main and sources JARs' : `${type} JAR`;
    const sizeInfo = estimatedSize ? ` (estimated size: ${estimatedSize})` : '';
    
    console.error(`\n📥 About to download ${typeDesc} for ${dependencyName}${sizeInfo}`);
    const response = await this.askQuestion('Continue? (y/N): ');
    
    return response.toLowerCase().startsWith('y');
  }

  /**
   * Ask user if they want to continue analysis with limited information
   */
  async promptForLimitedAnalysis(
    dependencyName: string,
    availableInfo: string
  ): Promise<boolean> {
    console.error(`\n⚠️  Limited information available for ${dependencyName}`);
    console.error(`Available: ${availableInfo}`);
    const response = await this.askQuestion('Continue with limited analysis? (y/N): ');
    
    return response.toLowerCase().startsWith('y');
  }

  /**
   * Show download progress
   */
  showDownloadProgress(
    dependencyName: string,
    type: 'main' | 'sources',
    status: 'starting' | 'downloading' | 'completed' | 'failed'
  ): void {
    const emoji = {
      starting: '🚀',
      downloading: '⬇️',
      completed: '✅',
      failed: '❌'
    };
    
    console.error(`${emoji[status]} ${status.charAt(0).toUpperCase() + status.slice(1)} ${type} JAR for ${dependencyName}`);
  }

  /**
   * Close the readline interface
   */
  close(): void {
    this.readline.close();
  }

  /**
   * Ask a question and return the response
   */
  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.readline.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}