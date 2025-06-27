# Maven API Explorer

An MCP (Model Context Protocol) server that helps AI assistants understand Java libraries from Maven dependencies.

## Features

- **Dependency Resolution**: Parse Maven POM files and resolve dependency trees
- **API Exploration**: Extract class, method, and field information from JAR files
- **Documentation Analysis**: Process Javadoc and source code to provide rich context about APIs
- **Smart Search**: Find classes and methods based on name, functionality, or task description
- **Usage Suggestions**: Get code examples and usage patterns for specific tasks
- **Code Generation**: Generate code examples for common design patterns and usage scenarios
- **Performant Caching**: Efficiently cache analyzed data to improve performance
- **Offline Support**: Fallback to local repository and source analysis when remote repositories are unavailable

## Tools

| Tool Name | Description |
|-----------|-------------|
| `analyze_pom` | Analyze a Maven POM file to extract dependencies |
| `analyze_jar` | Analyze a JAR file to extract class information (interactive) |
| `search_classes` | Search for Java classes by name or description |
| `search_methods` | Search for Java methods by name, return type, or description |
| `get_class_details` | Get detailed information about a Java class |
| `get_method_examples` | Get usage examples for a Java method |
| `analyze_project` | Analyze a complete Maven project including all dependencies (interactive) |
| `suggest_usage` | Suggest how to use a Java class for a specific task |
| `generate_code_pattern` | Generate code examples for common usage patterns of a Java class |
| `clear_cache` | Clear the cache to force fresh analysis |
| `check_maven_repository` | Check connectivity to Maven repositories |
| `set_offline_mode` | Enable/disable offline mode to prevent remote downloads |

## Code Generation Patterns

The `generate_code_pattern` tool supports the following patterns:

| Pattern | Description |
|---------|-------------|
| `builder` | Generates code using the Builder pattern |
| `singleton` | Generates code using the Singleton pattern |
| `factory` | Generates code using the Factory pattern |
| `stream` | Generates code using Java Stream operations |
| `crud` | Generates CRUD operations with a class |
| `rest` | Generates REST client usage examples |
| `callback` | Generates code with callback patterns |
| `async` | Generates code using async/CompletableFuture patterns |

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```

## Usage

You can run the server in two modes:

### Standard I/O Mode (Default)

```bash
# Default usage
node dist/index.js

# With custom local repository path (command line)
node dist/index.js --local-repo=/custom/path/to/repo

# With custom local repository path (environment variable)
MAVEN_LOCAL_REPO=/custom/path/to/repo node dist/index.js
```

### HTTP Server Mode (Optional)

```bash
MCP_TRANSPORT=sse MCP_PORT=3000 node dist/index.js
```

## Configuration

The Maven API Explorer supports multiple ways to configure the local Maven repository path:

### Priority Order
1. **Command line argument**: `--local-repo=/path/to/repo`
2. **Environment variable**: `MAVEN_LOCAL_REPO=/path/to/repo`
3. **Maven settings.xml**: `<localRepository>/path/to/repo</localRepository>`
4. **Default**: `~/.m2/repository`

### Configuration Examples

#### Command Line Argument
```bash
node dist/index.js --local-repo=/custom/maven/repository
```

#### Environment Variable
```bash
export MAVEN_LOCAL_REPO=/custom/maven/repository
node dist/index.js
```

#### MCP Client Configuration
For use with Claude Desktop or other MCP clients:

```json
{
  "mcpServers": {
    "maven-api-explorer": {
      "command": "node",
      "args": [
        "/path/to/maven-api-explorer/dist/index.js",
        "--local-repo=/custom/maven/repository"
      ],
      "env": {
        "MAVEN_LOCAL_REPO": "/custom/maven/repository"
      }
    }
  }
}
```

#### Maven Settings.xml
The server automatically reads Maven settings.xml files from:
- `~/.m2/settings.xml`
- `$MAVEN_HOME/conf/settings.xml`

Example settings.xml:
```xml
<settings>
  <localRepository>/custom/maven/repository</localRepository>
</settings>
```

## Interactive Dependency Management

The Maven API Explorer features **interactive dependency management** with user prompts for missing dependencies:

### Behavior When Dependencies Are Missing

When analyzing JARs that aren't available locally, the MCP will:

1. **Check local repository** for main JAR and sources JAR
2. **Prompt user for action** if neither is available:
   - Download sources JAR (recommended for analysis)
   - Download main JAR (compiled bytecode)
   - Download both JARs
   - Skip this dependency
   - Enter offline mode

3. **Ask for confirmation** before any downloads
4. **Show download progress** with status updates

### Example User Interaction

```
🔍 Dependency not found locally: org.apache.commons:commons-lang3:3.12.0
What would you like to do?
1. Download sources JAR (recommended for analysis)
2. Download main JAR (compiled bytecode)  
3. Download both JARs
4. Skip this dependency
5. Enter offline mode (skip all downloads)
Enter your choice (1-5): 1

📥 About to download sources JAR for org.apache.commons:commons-lang3:3.12.0
Continue? (y/N): y

🚀 Starting sources JAR for org.apache.commons:commons-lang3:3.12.0
✅ Completed sources JAR for org.apache.commons:commons-lang3:3.12.0
```

### Offline Mode

Use the `set_offline_mode` tool to prevent any remote downloads:

```bash
# Enable offline mode
set_offline_mode(offline=true)

# Disable offline mode  
set_offline_mode(offline=false)
```

## Example Workflows

### Analyzing a Maven Project

1. Use `analyze_project` to scan your Maven project
2. Search for classes with `search_classes` based on functionality
3. Get detailed API information with `get_class_details`
4. Find usage examples with `get_method_examples`

### Finding Library Usage Patterns

1. Use `search_methods` to find methods related to your task
2. Use `suggest_usage` to get recommended approaches for specific tasks
3. Explore class methods and fields to understand capabilities

### Generating Code Examples

1. Use `analyze_jar` or `analyze_project` to load class information
2. Search for relevant classes with `search_classes`
3. Use `generate_code_pattern` with a specific pattern (e.g., 'builder', 'async') to get code examples
4. Adapt the generated code examples to your specific requirements

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT