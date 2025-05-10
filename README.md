# Maven API Explorer

An MCP (Model Context Protocol) server that helps AI assistants understand Java libraries from Maven dependencies.

## Features

- **Dependency Resolution**: Parse Maven POM files and resolve dependency trees
- **API Exploration**: Extract class, method, and field information from JAR files
- **Documentation Analysis**: Process Javadoc and source code to provide rich context about APIs
- **Smart Search**: Find classes and methods based on name, functionality, or task description
- **Usage Suggestions**: Get code examples and usage patterns for specific tasks

## Tools

| Tool Name | Description |
|-----------|-------------|
| `analyze_pom` | Analyze a Maven POM file to extract dependencies |
| `analyze_jar` | Analyze a JAR file to extract class information |
| `search_classes` | Search for Java classes by name or description |
| `search_methods` | Search for Java methods by name, return type, or description |
| `get_class_details` | Get detailed information about a Java class |
| `get_method_examples` | Get usage examples for a Java method |
| `analyze_project` | Analyze a complete Maven project including all dependencies |
| `suggest_usage` | Suggest how to use a Java class for a specific task |

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
node dist/index.js
```

### HTTP Server Mode (Optional)

```bash
MCP_TRANSPORT=sse MCP_PORT=3000 node dist/index.js
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

## Testing

Run the test suite:

```bash
npm test
```

## License

MIT