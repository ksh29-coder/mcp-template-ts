#!/usr/bin/env node

import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from 'path';
import { MavenParser } from './services/maven-parser.js';
import { JarAnalyzer } from './services/jar-analyzer.js';
import { ApiSearch } from './services/api-search.js';
import { MavenDependency } from './models/types.js';

// Initialize services
const mavenParser = new MavenParser();
const jarAnalyzer = new JarAnalyzer();
const apiSearch = new ApiSearch();

// Create an MCP server
const server = new McpServer({
  name: "Maven API Explorer",
  version: "1.0.0",
  description: "Explore Java APIs from Maven dependencies",
});

// Tool to analyze POM file
server.tool(
  "analyze_pom",
  "Analyze a Maven POM file to extract dependencies",
  {
    pom_path: z.string().describe("The absolute path to the pom.xml file"),
  },
  async (params) => {
    try {
      const pomPath = params.pom_path;
      const project = await mavenParser.parsePom(pomPath);
      
      return {
        content: [{
          type: "text",
          text: `Successfully analyzed POM file: ${project.groupId}:${project.artifactId}:${project.version}\n\nFound ${project.dependencies.length} dependencies:${project.dependencies.map(dep => `\n- ${dep.groupId}:${dep.artifactId}:${dep.version}${dep.scope ? ' (' + dep.scope + ')' : ''}`).join('')}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error analyzing POM file: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to analyze JAR file
server.tool(
  "analyze_jar",
  "Analyze a JAR file to extract class information",
  {
    group_id: z.string().describe("The Maven group ID"),
    artifact_id: z.string().describe("The Maven artifact ID"),
    version: z.string().describe("The Maven version"),
  },
  async (params) => {
    try {
      const dependency: MavenDependency = {
        groupId: params.group_id,
        artifactId: params.artifact_id,
        version: params.version,
      };
      
      const classes = await jarAnalyzer.analyzeJar(dependency);
      
      // Index classes for search
      for (const javaClass of classes) {
        apiSearch.addClassToIndex(javaClass);
      }
      
      return {
        content: [{
          type: "text",
          text: `Successfully analyzed JAR: ${dependency.groupId}:${dependency.artifactId}:${dependency.version}\n\nFound ${classes.length} classes:${classes.slice(0, 10).map(c => `\n- ${c.packageName}.${c.name}`).join('')}${classes.length > 10 ? `\n- ...and ${classes.length - 10} more` : ''}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error analyzing JAR: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to search for classes
server.tool(
  "search_classes",
  "Search for Java classes by name or description",
  {
    query: z.string().describe("The search query"),
  },
  async (params) => {
    try {
      const results = apiSearch.searchClasses(params.query);
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No classes found matching query: ${params.query}`,
          }],
        };
      }
      
      const content = results.slice(0, 10).map(c => {
        let description = c.javadoc || 'No description available';
        // Truncate long descriptions
        if (description.length > 300) {
          description = description.substring(0, 300) + '...';
        }
        
        return {
          type: "text" as const,
          text: `**${c.packageName}.${c.name}**\n${c.isInterface ? 'Interface' : 'Class'} | ${c.modifiers.join(' ')}\n\n${description}\n\nMethods: ${c.methods.length} | Fields: ${c.fields.length}${c.superClass ? `\nExtends: ${c.superClass}` : ''}${c.interfaces.length > 0 ? `\nImplements: ${c.interfaces.join(', ')}` : ''}\n\n---\n`,
        };
      });
      
      if (results.length > 10) {
        content.push({
          type: "text" as const,
          text: `\n...and ${results.length - 10} more classes matching "${params.query}"`,
        });
      }
      
      return {
        content,
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error searching classes: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to search for methods
server.tool(
  "search_methods",
  "Search for Java methods by name, return type, or description",
  {
    query: z.string().describe("The search query"),
  },
  async (params) => {
    try {
      const results = apiSearch.searchMethods(params.query);
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No methods found matching query: ${params.query}`,
          }],
        };
      }
      
      const content = results.slice(0, 10).map(r => {
        const fullClassName = `${r.packageName}.${r.className}`;
        const classInfo = apiSearch.getClassByFullName(fullClassName);
        const methodInfo = classInfo ? classInfo.methods.find(m => m.name === r.methodName) : undefined;
        
        if (!classInfo || !methodInfo) {
          return {
            type: "text" as const,
            text: `Method not found: ${fullClassName}#${r.methodName}`,
          };
        }
        
        const paramStr = methodInfo.parameters.map(p => `${p.type} ${p.name}${p.description ? ` - ${p.description}` : ''}`).join('\n- ');
        
        return {
          type: "text" as const,
          text: `**${fullClassName}#${methodInfo.name}**\n\n${methodInfo.javadoc || 'No description available'}\n\n**Signature:**\n\`\`\`java\n${methodInfo.modifiers.join(' ')} ${methodInfo.returnType} ${methodInfo.name}(${methodInfo.parameters.map(p => `${p.type} ${p.name}`).join(', ')})${methodInfo.exceptions.length > 0 ? ` throws ${methodInfo.exceptions.join(', ')}` : ''}\n\`\`\`\n\n${methodInfo.parameters.length > 0 ? `**Parameters:**\n- ${paramStr}\n\n` : ''}**Example Usage:**\n\`\`\`java\n${r.snippet}\n\`\`\`\n\n---\n`,
        };
      });
      
      if (results.length > 10) {
        content.push({
          type: "text" as const,
          text: `\n...and ${results.length - 10} more methods matching "${params.query}"`,
        });
      }
      
      return {
        content,
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error searching methods: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to get detailed class information
server.tool(
  "get_class_details",
  "Get detailed information about a Java class",
  {
    package_name: z.string().describe("The package name"),
    class_name: z.string().describe("The class name"),
  },
  async (params) => {
    try {
      const fullClassName = `${params.package_name}.${params.class_name}`;
      const classInfo = apiSearch.getClassByFullName(fullClassName);
      
      if (!classInfo) {
        return {
          content: [{
            type: "text",
            text: `Class not found: ${fullClassName}`,
          }],
        };
      }
      
      // Build methods section
      const publicMethods = classInfo.methods
        .filter(m => m.modifiers.includes('public'))
        .sort((a, b) => a.name.localeCompare(b.name));
        
      const methodsText = publicMethods.map(m => {
        return `### ${m.name}\n\n${m.javadoc || 'No description available'}\n\n**Signature:**\n\`\`\`java\n${m.modifiers.join(' ')} ${m.returnType} ${m.name}(${m.parameters.map(p => `${p.type} ${p.name}`).join(', ')})${m.exceptions.length > 0 ? ` throws ${m.exceptions.join(', ')}` : ''}\n\`\`\`\n\n${m.parameters.length > 0 ? `**Parameters:**\n${m.parameters.map(p => `- \`${p.type} ${p.name}\`${p.description ? ` - ${p.description}` : ''}`).join('\n')}\n\n` : ''}`;
      }).join('\n\n');
      
      // Build fields section
      const publicFields = classInfo.fields
        .filter(f => f.modifiers.includes('public'))
        .sort((a, b) => a.name.localeCompare(b.name));
        
      const fieldsText = publicFields.map(f => {
        return `### ${f.name}\n\n${f.javadoc || 'No description available'}\n\n**Type:** \`${f.type}\`\n\n**Modifiers:** ${f.modifiers.join(', ')}`;
      }).join('\n\n');
      
      return {
        content: [{
          type: "text",
          text: `# ${classInfo.name}\n\n**Package:** ${classInfo.packageName}\n\n**Type:** ${classInfo.isInterface ? 'Interface' : 'Class'} | **Modifiers:** ${classInfo.modifiers.join(', ')}\n\n${classInfo.javadoc || 'No description available'}\n\n${classInfo.superClass ? `**Extends:** ${classInfo.superClass}\n\n` : ''}${classInfo.interfaces.length > 0 ? `**Implements:** ${classInfo.interfaces.join(', ')}\n\n` : ''}\n\n## Public Methods\n\n${publicMethods.length > 0 ? methodsText : 'No public methods'}\n\n## Public Fields\n\n${publicFields.length > 0 ? fieldsText : 'No public fields'}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error retrieving class details: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to get method examples
server.tool(
  "get_method_examples",
  "Get usage examples for a Java method",
  {
    package_name: z.string().describe("The package name"),
    class_name: z.string().describe("The class name"),
    method_name: z.string().describe("The method name"),
  },
  async (params) => {
    try {
      const fullClassName = `${params.package_name}.${params.class_name}`;
      const classInfo = apiSearch.getClassByFullName(fullClassName);
      
      if (!classInfo) {
        return {
          content: [{
            type: "text",
            text: `Class not found: ${fullClassName}`,
          }],
        };
      }
      
      const methodInfo = classInfo.methods.find(m => m.name === params.method_name);
      if (!methodInfo) {
        return {
          content: [{
            type: "text",
            text: `Method not found: ${fullClassName}#${params.method_name}`,
          }],
        };
      }
      
      const examples = apiSearch.getMethodExamples(fullClassName, params.method_name);
      const isStatic = methodInfo.modifiers.includes('static');
      
      // If no existing examples, generate one
      if (examples.length === 0) {
        const instanceName = classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1);
        const paramValues = methodInfo.parameters.map(p => {
          const type = p.type.replace(/<.*>/g, '');
          switch (type) {
            case 'int': case 'long': case 'short': case 'byte': return '0';
            case 'float': case 'double': return '0.0';
            case 'boolean': return 'false';
            case 'char': return "'a'";
            case 'String': return '"example"';
            default: return type.endsWith('[]') ? `new ${type}{}` : 'null';
          }
        });
        
        const paramsStr = paramValues.join(', ');
        const generatedExample = isStatic
          ? `${fullClassName}.${methodInfo.name}(${paramsStr});`
          : `${fullClassName} ${instanceName} = new ${fullClassName}(/* constructor params */);\n${instanceName}.${methodInfo.name}(${paramsStr});`;
        
        examples.push(generatedExample);
      }
      
      return {
        content: [{
          type: "text",
          text: `# Usage Examples for ${classInfo.name}#${methodInfo.name}\n\n**Signature:**\n\`\`\`java\n${methodInfo.modifiers.join(' ')} ${methodInfo.returnType} ${methodInfo.name}(${methodInfo.parameters.map(p => `${p.type} ${p.name}`).join(', ')})${methodInfo.exceptions.length > 0 ? ` throws ${methodInfo.exceptions.join(', ')}` : ''}\n\`\`\`\n\n${examples.map((example, i) => `## Example ${i + 1}\n\n\`\`\`java\n${example}\n\`\`\``).join('\n\n')}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error retrieving method examples: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to analyze a complete Maven project
server.tool(
  "analyze_project",
  "Analyze a complete Maven project including all dependencies",
  {
    project_path: z.string().describe("The path to the Maven project (containing pom.xml)"),
  },
  async (params) => {
    try {
      const projectPath = params.project_path;
      const pomPath = path.join(projectPath, 'pom.xml');
      
      // Parse POM file
      const project = await mavenParser.parsePom(pomPath);
      
      // Resolve dependencies
      const dependencies = await mavenParser.resolveDependencyTree(pomPath);
      
      // Analyze each JAR
      let processedCount = 0;
      
      for (const dependency of dependencies) {
        try {
          // Skip test and provided dependencies
          if (dependency.scope === 'test' || dependency.scope === 'provided') {
            processedCount++;
            continue;
          }
          
          const classes = await jarAnalyzer.analyzeJar(dependency);
          
          // Index classes for search
          for (const javaClass of classes) {
            apiSearch.addClassToIndex(javaClass);
          }
          
          processedCount++;
          console.log(`Processed ${processedCount}/${dependencies.length} dependencies`);
        } catch (err) {
          const error = err as Error;
          console.warn(`Error analyzing dependency ${dependency.groupId}:${dependency.artifactId}: ${error.message}`);
          processedCount++;
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `Successfully analyzed project: ${project.groupId}:${project.artifactId}:${project.version}\n\nAnalyzed ${dependencies.length} dependencies.${dependencies.length > 0 ? `\n\nKey dependencies:\n${dependencies.filter(d => d.scope !== 'test' && d.scope !== 'provided').slice(0, 10).map(d => `- ${d.groupId}:${d.artifactId}:${d.version}${d.scope ? ' (' + d.scope + ')' : ''}`).join('\n')}${dependencies.length > 10 ? `\n- ...and ${dependencies.length - 10} more` : ''}` : ''}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error analyzing project: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Tool to suggest how to use a class
server.tool(
  "suggest_usage",
  "Suggest how to use a Java class for a specific task",
  {
    package_name: z.string().describe("The package name"),
    class_name: z.string().describe("The class name"),
    task_description: z.string().describe("Description of the task you want to accomplish"),
  },
  async (params) => {
    try {
      const fullClassName = `${params.package_name}.${params.class_name}`;
      const classInfo = apiSearch.getClassByFullName(fullClassName);
      
      if (!classInfo) {
        return {
          content: [{
            type: "text",
            text: `Class not found: ${fullClassName}`,
          }],
        };
      }
      
      // Find relevant methods for the task
      const taskWords = params.task_description.toLowerCase().split(/\s+/);
      
      // Score methods based on relevance to the task
      const methodScores = classInfo.methods
        .filter(m => m.modifiers.includes('public'))
        .map(method => {
          let score = 0;
          
          // Score based on method name
          for (const word of taskWords) {
            if (method.name.toLowerCase().includes(word)) {
              score += 3;
            }
          }
          
          // Score based on javadoc
          if (method.javadoc) {
            for (const word of taskWords) {
              if (method.javadoc.toLowerCase().includes(word)) {
                score += 2;
              }
            }
          }
          
          return { method, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Get top 5 methods
      
      if (methodScores.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No methods found in ${fullClassName} that match the task description: "${params.task_description}". Try a different class or rephrase your task.`,
          }],
        };
      }
      
      // Generate example usage of the class for the task
      let exampleCode = `// Example of using ${classInfo.name} for: ${params.task_description}\n`;
      
      // Instance creation if needed
      const hasNonStatic = methodScores.some(item => !item.method.modifiers.includes('static'));
      
      if (hasNonStatic) {
        const instanceName = classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1);
        exampleCode += `${fullClassName} ${instanceName} = new ${fullClassName}(/* required constructor parameters */);\n\n`;
        
        // Add method calls
        for (const { method } of methodScores) {
          if (method.modifiers.includes('static')) {
            exampleCode += `// Static method\n${fullClassName}.${method.name}(${method.parameters.map(() => '/* ... */').join(', ')});\n`;
          } else {
            exampleCode += `// Instance method\n${instanceName}.${method.name}(${method.parameters.map(() => '/* ... */').join(', ')});\n`;
          }
          exampleCode += '\n';
        }
      } else {
        // Just static method calls
        for (const { method } of methodScores) {
          exampleCode += `// Static method\n${fullClassName}.${method.name}(${method.parameters.map(() => '/* ... */').join(', ')});\n\n`;
        }
      }
      
      // Generate explanation
      let explanation = `To accomplish the task "${params.task_description}" using ${classInfo.name}, you can use the following methods:\n\n`;
      
      for (const { method } of methodScores) {
        explanation += `### ${method.name}\n\n`;
        explanation += method.javadoc ? `${method.javadoc}\n\n` : '';
        explanation += `**Signature:** \`${method.modifiers.join(' ')} ${method.returnType} ${method.name}(${method.parameters.map(p => `${p.type} ${p.name}`).join(', ')})\`\n\n`;
        
        if (method.parameters.length > 0) {
          explanation += "**Parameters:**\n";
          for (const param of method.parameters) {
            explanation += `- \`${param.type} ${param.name}\`${param.description ? ` - ${param.description}` : ''}\n`;
          }
          explanation += '\n';
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `# How to use ${classInfo.name} for: ${params.task_description}\n\n${explanation}\n\n## Example Code\n\n\`\`\`java\n${exampleCode}\n\`\`\`\n\nThese examples show how to use the most relevant methods for your task. You may need to adjust the parameters and error handling based on your specific requirements.`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error generating usage suggestion: ${error.message}`,
        }],
        error: true,
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

// Start the server
console.log('Starting Maven API Explorer MCP server...');
await server.connect(transport);