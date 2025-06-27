# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the Maven API Explorer - an MCP (Model Context Protocol) server that enables AI assistants to understand and explore Java libraries from Maven dependencies. The server provides comprehensive tools for analyzing Maven projects, extracting API information from JAR files, and generating code examples.

## Architecture Overview

The codebase follows a modular service-oriented architecture with clear separation of concerns:

### Core Services (src/services/)
- **MavenParser**: Parses Maven POM files and resolves dependency trees
- **JarAnalyzer**: Extracts Java class information from JAR files using bytecode analysis
- **ApiSearch**: Provides in-memory indexing and search capabilities for Java classes and methods
- **CodeGenerator**: Generates code examples and patterns for Java classes
- **CacheService**: Handles persistent caching of analyzed data for performance optimization

### Data Models (src/models/types.ts)
- **MavenDependency/MavenProject**: Maven-specific data structures
- **JavaClass/JavaMethod/JavaField**: Java API metadata structures
- **ApiSearchResult**: Search result containers

### MCP Server Entry Point (src/index.ts)
The main server defines 11 MCP tools for various operations like analyzing POMs, JARs, searching APIs, and generating code patterns.

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Build the server
npm run build

# Build with file watching for development
npm run watch

# Run tests
npm test
```

### Server Execution
```bash
# Run the MCP server (stdio mode)
node dist/index.js

# Run with custom local repository (command line)
node dist/index.js --local-repo=/custom/maven/repo

# Run with custom local repository (environment variable)
MAVEN_LOCAL_REPO=/custom/maven/repo node dist/index.js

# Run with HTTP transport
MCP_TRANSPORT=sse MCP_PORT=3000 node dist/index.js
```

## Configuration

### Local Repository Detection
The server supports multiple ways to configure the Maven local repository path with the following priority order:

1. **Command line argument**: `--local-repo=/path/to/repo`
2. **Environment variable**: `MAVEN_LOCAL_REPO=/path/to/repo`  
3. **Maven settings.xml**: Automatic parsing of `~/.m2/settings.xml` and `$MAVEN_HOME/conf/settings.xml`
4. **Default**: `~/.m2/repository`

### MCP Client Configuration
```json
{
  "mcpServers": {
    "maven-api-explorer": {
      "command": "node",
      "args": ["/path/to/dist/index.js", "--local-repo=/custom/repo"],
      "env": {"MAVEN_LOCAL_REPO": "/custom/repo"}
    }
  }
}
```

## Testing

The project uses Jest with TypeScript support. Test files are located in `src/tests/` and follow the naming pattern `*.test.ts`. The test configuration supports ES modules and includes:

- Unit tests for service components
- Mock Java class creation utilities
- API search functionality testing

Run tests with: `npm test`

## Key Technical Details

### Dependencies
- **@modelcontextprotocol/sdk**: Core MCP server functionality
- **xml2js**: Maven POM file parsing
- **java-class-tools**: Java bytecode analysis
- **jszip**: JAR file extraction
- **cheerio**: HTML/XML parsing for documentation
- **zod**: Runtime type validation

### Caching Strategy
The CacheService implements persistent caching to improve performance by storing analyzed JAR data between sessions. Cache is automatically persisted on process exit signals (SIGINT/SIGTERM).

### Error Handling
All MCP tools follow consistent error handling patterns, returning structured error responses with user-friendly messages while logging detailed errors for debugging.

### Search Capabilities
The ApiSearch service provides fuzzy matching for:
- Class names and package names
- Method names and signatures
- Javadoc content
- Task-based method recommendations

## MCP Tools Available

The server exposes 12 tools:
- `analyze_pom`: Parse Maven POM files
- `analyze_jar`: Extract classes from JAR files (interactive)
- `search_classes/search_methods`: API discovery
- `get_class_details/get_method_examples`: Detailed API information
- `analyze_project`: Full project dependency analysis (interactive)
- `suggest_usage`: Task-based usage recommendations
- `generate_code_pattern`: Pattern-based code generation
- `clear_cache`: Cache management
- `check_maven_repository`: Repository connectivity testing
- `set_offline_mode`: Enable/disable offline mode

## Interactive Dependency Management

### Key Features
- **User prompts** for missing dependencies with multiple options
- **Sources JAR preference** for better analysis quality
- **Download confirmation** before any remote fetching
- **Offline mode** to prevent all remote downloads
- **Progress feedback** during downloads

### Priority Flow
1. Use local main JAR if available
2. Use local sources JAR if main JAR missing
3. Prompt user for download options if neither available
4. Download based on user choice (sources preferred)
5. Fall back to offline mode if requested

## Code Generation Patterns

The CodeGenerator supports these patterns:
- `builder`: Builder pattern implementations
- `singleton`: Singleton pattern examples
- `factory`: Factory pattern usage
- `stream`: Java Stream API operations
- `crud`: CRUD operation examples
- `rest`: REST client patterns
- `callback`: Callback pattern implementations
- `async`: CompletableFuture/async patterns