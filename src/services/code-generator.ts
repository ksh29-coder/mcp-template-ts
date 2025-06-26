import { JavaClass, JavaMethod } from '../models/types.js';

/**
 * Service for generating code examples for Java classes and methods
 */
export class CodeGenerator {
  /**
   * Generate code for a common usage pattern based on a class
   * @param javaClass The Java class to generate code for
   * @param pattern The usage pattern to generate (e.g., 'builder', 'singleton', 'factory', etc.)
   * @returns Generated code example
   */
  generatePattern(javaClass: JavaClass, pattern: string): string {
    switch (pattern.toLowerCase()) {
      case 'builder':
        return this.generateBuilderPattern(javaClass);
      case 'singleton':
        return this.generateSingletonPattern(javaClass);
      case 'factory':
        return this.generateFactoryPattern(javaClass);
      case 'stream':
        return this.generateStreamPattern(javaClass);
      case 'crud':
        return this.generateCrudPattern(javaClass);
      case 'rest':
        return this.generateRestClientPattern(javaClass);
      case 'callback':
        return this.generateCallbackPattern(javaClass);
      case 'async':
        return this.generateAsyncPattern(javaClass);
      default:
        return this.generateBasicUsage(javaClass);
    }
  }

  /**
   * Generate a basic usage example for a class
   */
  generateBasicUsage(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Find constructor or static factory method
    const constructor = javaClass.methods.find(m => m.name === javaClass.name);
    const staticFactoryMethod = javaClass.methods.find(m => 
      m.modifiers.includes('static') && 
      m.returnType.includes(javaClass.name) && 
      (m.name.startsWith('create') || m.name.startsWith('new') || m.name.startsWith('of'))
    );
    
    // Find some public methods that might be useful (non-getters/setters first)
    const publicMethods = javaClass.methods
      .filter(m => m.modifiers.includes('public') && !m.modifiers.includes('static'))
      .filter(m => !this.isGetterOrSetter(m))
      .slice(0, 2);
      
    if (publicMethods.length < 2) {
      // Add some getters/setters if we don't have enough methods
      const gettersSetters = javaClass.methods
        .filter(m => m.modifiers.includes('public') && !m.modifiers.includes('static'))
        .filter(m => this.isGetterOrSetter(m))
        .slice(0, 2 - publicMethods.length);
        
      publicMethods.push(...gettersSetters);
    }
    
    let code = `// Basic usage example for ${fullClassName}\n`;
    code += `import ${fullClassName};\n\n`;
    code += `public class ${javaClass.name}Example {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Instance creation
    if (javaClass.isInterface || javaClass.isAbstract) {
      code += `        // Note: ${javaClass.name} is ${javaClass.isInterface ? 'an interface' : 'abstract'}, so you need an implementation\n`;
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}Implementation();\n`;
    } else if (staticFactoryMethod) {
      const params = this.generateMethodParams(staticFactoryMethod);
      code += `        ${fullClassName} ${instanceName} = ${fullClassName}.${staticFactoryMethod.name}(${params});\n`;
    } else if (constructor) {
      const params = this.generateMethodParams(constructor);
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}(${params});\n`;
    } else {
      // Default constructor
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n`;
    }
    
    // Method calls
    code += '\n        // Example method calls\n';
    for (const method of publicMethods) {
      const params = this.generateMethodParams(method);
      const returnStmt = method.returnType !== 'void' ? `${method.returnType} result = ` : '';
      code += `        ${returnStmt}${instanceName}.${method.name}(${params});\n`;
    }
    
    code += '    }\n';
    code += '}\n';
    
    return code;
  }

  /**
   * Generate example using the Builder pattern
   */
  generateBuilderPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Look for a builder method or nested Builder class
    const builderMethod = javaClass.methods.find(m => 
      (m.name === 'builder' || m.name === 'newBuilder') && 
      (m.returnType.includes('Builder') || m.returnType.includes(javaClass.name))
    );
    
    // If no builder method found, show a typical builder pattern
    if (!builderMethod) {
      return this.generateGenericBuilderPattern(javaClass);
    }
    
    // Get public setters to use as builder methods
    const setters = javaClass.methods
      .filter(m => m.modifiers.includes('public') && m.name.startsWith('set') && m.parameters.length === 1)
      .slice(0, 5);
      
    let code = `// Builder pattern usage for ${fullClassName}\n`;
    code += `import ${fullClassName};\n\n`;
    code += `public class ${javaClass.name}BuilderExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Builder creation
    code += `        ${fullClassName} ${instanceName} = ${fullClassName}.${builderMethod.name}()\n`;
    
    // Add setter methods as chain calls
    for (const setter of setters) {
      const fieldName = setter.name.substring(3, 4).toLowerCase() + setter.name.substring(4);
      const paramValue = this.generateDefaultValue(setter.parameters[0].type);
      code += `            .${fieldName}(${paramValue})\n`;
    }
    
    code += `            .build();\n\n`;
    code += `        // Use the built object\n`;
    code += `        System.out.println(${instanceName});\n`;
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Generate a generic builder pattern example if no actual builder is found
   */
  private generateGenericBuilderPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Get some fields to use in the builder
    const fields = javaClass.fields
      .filter(f => f.modifiers.includes('public') || this.hasGetterSetter(javaClass, f.name))
      .slice(0, 5);
      
    let code = `// Example of how a Builder pattern would work with ${fullClassName}\n`;
    code += `// Note: This is a conceptual example, as ${javaClass.name} doesn't have a built-in Builder\n`;
    code += `import ${fullClassName};\n\n`;
    code += `public class ${javaClass.name}BuilderExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    code += `        // Conceptual Builder pattern (implement this if needed)\n`;
    code += `        ${fullClassName} ${instanceName} = new ${javaClass.name}Builder()\n`;
    
    // Add setter methods as chain calls
    for (const field of fields) {
      const paramValue = this.generateDefaultValue(field.type);
      code += `            .${field.name}(${paramValue})\n`;
    }
    
    code += `            .build();\n\n`;
    code += `        // Use the built object\n`;
    code += `        System.out.println(${instanceName});\n`;
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }

  /**
   * Generate example using the Singleton pattern
   */
  generateSingletonPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    
    // Check if the class appears to be a singleton
    const instanceMethod = javaClass.methods.find(m => 
      m.modifiers.includes('static') && 
      m.returnType.includes(javaClass.name) && 
      (m.name === 'getInstance' || m.name === 'instance' || m.name === 'getInjection')
    );
    
    let code = `// Singleton pattern usage for ${fullClassName}\n`;
    code += `import ${fullClassName};\n\n`;
    code += `public class ${javaClass.name}SingletonExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    if (instanceMethod) {
      // Use the actual singleton method
      const params = this.generateMethodParams(instanceMethod);
      code += `        // Get the singleton instance\n`;
      code += `        ${fullClassName} instance = ${fullClassName}.${instanceMethod.name}(${params});\n\n`;
    } else {
      // Show a conceptual singleton pattern
      code += `        // Note: ${javaClass.name} might not be designed as a singleton\n`;
      code += `        // This is how you would use it if it were a singleton:\n`;
      code += `        ${fullClassName} instance = ${fullClassName}.getInstance();\n\n`;
    }
    
    // Add method calls
    const publicMethods = javaClass.methods
      .filter(m => m.modifiers.includes('public') && !m.modifiers.includes('static'))
      .slice(0, 2);
      
    if (publicMethods.length > 0) {
      code += `        // Use the singleton instance\n`;
      for (const method of publicMethods) {
        const params = this.generateMethodParams(method);
        code += `        instance.${method.name}(${params});\n`;
      }
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }

  /**
   * Generate example using the Factory pattern
   */
  generateFactoryPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    
    // Check if this could be a factory
    const factoryMethods = javaClass.methods
      .filter(m => 
        m.modifiers.includes('static') && 
        m.returnType !== 'void' && 
        !m.returnType.includes(javaClass.name) &&
        (m.name.startsWith('create') || m.name.startsWith('new') || m.name.startsWith('get'))
      )
      .slice(0, 3);
      
    let code = `// Factory pattern usage for ${fullClassName}\n`;
    code += `import ${fullClassName};\n\n`;
    code += `public class ${javaClass.name}FactoryExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    if (factoryMethods.length > 0) {
      // Use the actual factory methods
      code += `        // Use factory methods to create objects\n`;
      for (const method of factoryMethods) {
        const params = this.generateMethodParams(method);
        const resultName = this.getInstanceName(method.returnType.split('<')[0].split('.').pop() || 'result');
        code += `        ${method.returnType} ${resultName} = ${fullClassName}.${method.name}(${params});\n`;
      }
    } else {
      // Show a conceptual factory pattern
      code += `        // Note: ${javaClass.name} might not be designed as a factory\n`;
      code += `        // This is how you would use it if it were a factory:\n`;
      code += `        SomeProduct product1 = ${fullClassName}.createProduct("type1");\n`;
      code += `        SomeProduct product2 = ${fullClassName}.createProduct("type2");\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }

  /**
   * Generate example using Java Streams (for collections)
   */
  generateStreamPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Find methods that return collections or arrays
    const collectionMethods = javaClass.methods
      .filter(m => 
        m.modifiers.includes('public') && 
        (m.returnType.includes('List') || 
         m.returnType.includes('Set') || 
         m.returnType.includes('Collection') ||
         m.returnType.includes('[]'))
      )
      .slice(0, 2);
      
    let code = `// Java Streams usage with ${fullClassName}\n`;
    code += `import ${fullClassName};\n`;
    code += `import java.util.List;\n`;
    code += `import java.util.stream.Collectors;\n\n`;
    code += `public class ${javaClass.name}StreamExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Instance creation (simplified)
    if (!javaClass.isInterface && !javaClass.isAbstract) {
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n\n`;
    } else {
      code += `        // Create an instance of ${javaClass.name} implementation\n`;
      code += `        ${fullClassName} ${instanceName} = get${javaClass.name}Instance();\n\n`;
    }
    
    if (collectionMethods.length > 0) {
      // Use actual collection methods
      for (const method of collectionMethods) {
        const params = this.generateMethodParams(method);
        const returnType = method.returnType;
        let elementType = "Object";
        
        // Try to extract the generic type
        if (returnType.includes("<") && returnType.includes(">")) {
          elementType = returnType.substring(returnType.indexOf("<") + 1, returnType.lastIndexOf(">"));
        } else if (returnType.includes("[]")) {
          elementType = returnType.substring(0, returnType.indexOf("[]"));
        }
        
        const resultName = method.name.startsWith("get") 
          ? this.getInstanceName(method.name.substring(3)) 
          : this.getInstanceName(method.name) + "Results";
          
        code += `        // Process collection with streams\n`;
        code += `        ${method.returnType} ${resultName} = ${instanceName}.${method.name}(${params});\n`;
        
        // Generate stream operations
        if (returnType.includes("[]")) {
          code += `        List<${elementType}> processed = Arrays.stream(${resultName})\n`;
        } else {
          code += `        List<${elementType}> processed = ${resultName}.stream()\n`;
        }
        
        code += `            .filter(item -> item != null) // Filter condition\n`;
        code += `            .map(item -> process(item)) // Transform items\n`;
        code += `            .sorted() // Sort items\n`;
        code += `            .collect(Collectors.toList());\n\n`;
        
        code += `        processed.forEach(System.out::println);\n\n`;
      }
    } else {
      // Generic stream example
      code += `        // Example Stream processing (conceptual)\n`;
      code += `        List<SomeItem> items = ${instanceName}.getItems();\n\n`;
      code += `        List<ProcessedItem> processedItems = items.stream()\n`;
      code += `            .filter(item -> item.isValid())\n`;
      code += `            .map(item -> new ProcessedItem(item))\n`;
      code += `            .sorted(Comparator.comparing(ProcessedItem::getName))\n`;
      code += `            .collect(Collectors.toList());\n\n`;
      
      code += `        processedItems.forEach(System.out::println);\n`;
    }
    
    if (javaClass.isInterface || javaClass.isAbstract) {
      // Add helper method for getting instance
      code += `    }\n\n`;
      code += `    // Helper method to get implementation instance\n`;
      code += `    private static ${fullClassName} get${javaClass.name}Instance() {\n`;
      code += `        // Return an implementation instance\n`;
      code += `        return null; // Replace with actual implementation\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Generate CRUD operations example
   */
  generateCrudPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Try to determine if this class is related to data access
    const isRepository = javaClass.name.includes('Repository') || 
                        javaClass.name.includes('DAO') ||
                        javaClass.name.includes('Service') ||
                        javaClass.interfaces.some(i => i.includes('Repository') || i.includes('DAO'));
                        
    // Look for CRUD-like methods
    const createMethod = javaClass.methods.find(m => 
      m.name.includes('create') || m.name.includes('save') || m.name.includes('insert') || m.name.includes('add')
    );
    
    const readMethod = javaClass.methods.find(m => 
      m.name.includes('find') || m.name.includes('get') || m.name.includes('read') || m.name.includes('select')
    );
    
    const updateMethod = javaClass.methods.find(m => 
      m.name.includes('update') || m.name.includes('modify') || m.name.includes('edit')
    );
    
    const deleteMethod = javaClass.methods.find(m => 
      m.name.includes('delete') || m.name.includes('remove')
    );
    
    let entityType = "Entity";
    
    // Try to determine entity type from methods
    if (createMethod && createMethod.parameters.length > 0) {
      entityType = createMethod.parameters[0].type;
    } else if (readMethod && readMethod.returnType !== 'void') {
      const returnType = readMethod.returnType;
      if (returnType.includes('List<') || returnType.includes('Collection<')) {
        // Extract generic type
        entityType = returnType.substring(returnType.indexOf('<') + 1, returnType.lastIndexOf('>'));
      } else if (!returnType.includes('String') && !returnType.includes('Integer') && !returnType.includes('Long')) {
        entityType = returnType;
      }
    }
    
    let code = `// CRUD operations with ${fullClassName}\n`;
    code += `import ${fullClassName};\n\n`;
    
    if (!isRepository) {
      code += `// Note: This is a conceptual example as ${javaClass.name} might not be a repository/DAO\n`;
    }
    
    code += `public class ${javaClass.name}CrudExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Repository instance creation
    if (javaClass.isInterface || javaClass.isAbstract) {
      code += `        // Get repository instance (implementation or through dependency injection)\n`;
      code += `        ${fullClassName} ${instanceName} = get${javaClass.name}Instance();\n\n`;
    } else {
      code += `        // Create repository instance\n`;
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n\n`;
    }
    
    // Create entity
    code += `        // Create operation\n`;
    if (createMethod) {
      const params = this.generateMethodParams(createMethod);
      const returnVar = createMethod.returnType !== 'void' ? `${entityType} created = ` : '';
      code += `        ${returnVar}${instanceName}.${createMethod.name}(${params});\n\n`;
    } else {
      code += `        ${entityType} newEntity = new ${entityType}();\n`;
      code += `        // Set entity properties\n`;
      code += `        ${instanceName}.save(newEntity);\n\n`;
    }
    
    // Read entity
    code += `        // Read operation\n`;
    if (readMethod) {
      const params = this.generateMethodParams(readMethod);
      if (readMethod.returnType.includes('List') || readMethod.returnType.includes('Collection')) {
        code += `        ${readMethod.returnType} entities = ${instanceName}.${readMethod.name}(${params});\n`;
        code += `        entities.forEach(System.out::println);\n\n`;
      } else {
        code += `        ${readMethod.returnType} entity = ${instanceName}.${readMethod.name}(${params});\n`;
        code += `        System.out.println(entity);\n\n`;
      }
    } else {
      code += `        // Find by ID\n`;
      code += `        ${entityType} entity = ${instanceName}.findById(1L);\n`;
      code += `        \n`;
      code += `        // Find all\n`;
      code += `        List<${entityType}> allEntities = ${instanceName}.findAll();\n\n`;
    }
    
    // Update entity
    code += `        // Update operation\n`;
    if (updateMethod) {
      const params = this.generateMethodParams(updateMethod);
      const returnVar = updateMethod.returnType !== 'void' ? `${entityType} updated = ` : '';
      code += `        ${returnVar}${instanceName}.${updateMethod.name}(${params});\n\n`;
    } else {
      code += `        // Update entity properties\n`;
      code += `        entity.setProperty("updated value");\n`;
      code += `        ${instanceName}.save(entity);\n\n`;
    }
    
    // Delete entity
    code += `        // Delete operation\n`;
    if (deleteMethod) {
      const params = this.generateMethodParams(deleteMethod);
      code += `        ${instanceName}.${deleteMethod.name}(${params});\n`;
    } else {
      code += `        ${instanceName}.delete(entity);\n`;
      code += `        // Or delete by ID\n`;
      code += `        ${instanceName}.deleteById(1L);\n`;
    }
    
    if (javaClass.isInterface || javaClass.isAbstract) {
      // Add helper method for getting instance
      code += `    }\n\n`;
      code += `    // Helper method to get implementation instance\n`;
      code += `    private static ${fullClassName} get${javaClass.name}Instance() {\n`;
      code += `        // Return an implementation instance\n`;
      code += `        return null; // Replace with actual implementation\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Generate REST client pattern
   */
  generateRestClientPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Check if class looks like a REST client
    const isRestClient = javaClass.name.includes('Client') || 
                        javaClass.name.includes('Service') ||
                        javaClass.name.includes('Api') ||
                        javaClass.name.includes('Http');
                        
    // Look for HTTP-related methods
    const httpMethods = javaClass.methods.filter(m => 
      m.name.includes('get') || m.name.includes('post') || 
      m.name.includes('put') || m.name.includes('delete') ||
      m.name.includes('request') || m.name.includes('fetch')
    ).slice(0, 3);
    
    let code = `// REST client usage with ${fullClassName}\n`;
    code += `import ${fullClassName};\n`;
    
    if (!isRestClient && httpMethods.length === 0) {
      code += `// Note: This is a conceptual example as ${javaClass.name} might not be a REST client\n`;
    }
    
    code += `import java.util.concurrent.CompletableFuture;\n\n`;
    code += `public class ${javaClass.name}RestExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Client instance creation
    if (javaClass.isInterface || javaClass.isAbstract) {
      code += `        // Get client instance (implementation or through DI)\n`;
      code += `        ${fullClassName} ${instanceName} = get${javaClass.name}Instance();\n\n`;
    } else {
      code += `        // Create REST client instance\n`;
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n\n`;
    }
    
    if (httpMethods.length > 0) {
      // Use actual HTTP methods
      code += `        // Make HTTP requests\n`;
      for (const method of httpMethods) {
        const params = this.generateMethodParams(method);
        const isAsync = method.returnType.includes('Future') || 
                        method.returnType.includes('Mono') || 
                        method.returnType.includes('Flux') ||
                        method.returnType.includes('Observable');
        
        let responseType = method.returnType;
        // Extract actual response type if wrapped
        if (responseType.includes('<') && responseType.includes('>')) {
          responseType = responseType.substring(responseType.indexOf('<') + 1, responseType.lastIndexOf('>'));
        }
        
        if (isAsync) {
          code += `        // Asynchronous request\n`;
          code += `        ${method.returnType} response = ${instanceName}.${method.name}(${params});\n`;
          if (method.returnType.includes('Future')) {
            code += `        response.thenAccept(result -> {\n`;
            code += `            System.out.println("Received: " + result);\n`;
            code += `        }).exceptionally(ex -> {\n`;
            code += `            System.err.println("Error: " + ex.getMessage());\n`;
            code += `            return null;\n`;
            code += `        });\n\n`;
          } else {
            code += `        // Subscribe or handle the async response\n`;
            code += `        // (Implementation depends on the reactive library used)\n\n`;
          }
        } else {
          code += `        // Synchronous request\n`;
          const resultVar = method.returnType !== 'void' ? `${responseType} response = ` : '';
          code += `        ${resultVar}${instanceName}.${method.name}(${params});\n`;
          if (method.returnType !== 'void') {
            code += `        System.out.println("Received: " + response);\n\n`;
          }
        }
      }
    } else {
      // Generic REST client example
      code += `        // Example REST API calls\n`;
      code += `        // GET request\n`;
      code += `        ResponseType getResponse = ${instanceName}.get("https://api.example.com/resources/123");\n`;
      code += `        System.out.println("GET response: " + getResponse);\n\n`;
      
      code += `        // POST request\n`;
      code += `        RequestBody requestBody = new RequestBody("field1", "field2");\n`;
      code += `        ResponseType postResponse = ${instanceName}.post("https://api.example.com/resources", requestBody);\n`;
      code += `        System.out.println("POST response: " + postResponse);\n\n`;
      
      code += `        // PUT request\n`;
      code += `        ResponseType putResponse = ${instanceName}.put("https://api.example.com/resources/123", requestBody);\n`;
      code += `        System.out.println("PUT response: " + putResponse);\n\n`;
      
      code += `        // DELETE request\n`;
      code += `        ResponseType deleteResponse = ${instanceName}.delete("https://api.example.com/resources/123");\n`;
      code += `        System.out.println("DELETE response: " + deleteResponse);\n`;
    }
    
    if (javaClass.isInterface || javaClass.isAbstract) {
      // Add helper method for getting instance
      code += `    }\n\n`;
      code += `    // Helper method to get implementation instance\n`;
      code += `    private static ${fullClassName} get${javaClass.name}Instance() {\n`;
      code += `        // Return an implementation instance\n`;
      code += `        return null; // Replace with actual implementation\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Generate example with callback pattern
   */
  generateCallbackPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Look for methods that accept callbacks/listeners
    const callbackMethods = javaClass.methods.filter(m => 
      m.parameters.some(p => 
        p.type.includes('Callback') || 
        p.type.includes('Listener') || 
        p.type.includes('Handler') ||
        p.type.toLowerCase().includes('consumer')
      )
    ).slice(0, 2);
    
    let code = `// Callback pattern with ${fullClassName}\n`;
    code += `import ${fullClassName};\n`;
    code += `import java.util.function.Consumer;\n\n`;
    
    if (callbackMethods.length === 0) {
      code += `// Note: This is a conceptual example as ${javaClass.name} might not use callbacks\n`;
    }
    
    code += `public class ${javaClass.name}CallbackExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Instance creation
    if (javaClass.isInterface || javaClass.isAbstract) {
      code += `        // Get instance (implementation or through DI)\n`;
      code += `        ${fullClassName} ${instanceName} = get${javaClass.name}Instance();\n\n`;
    } else {
      code += `        // Create instance\n`;
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n\n`;
    }
    
    if (callbackMethods.length > 0) {
      // Use actual callback methods
      code += `        // Register callbacks\n`;
      for (const method of callbackMethods) {
        const callbackParams = [];
        
        for (const param of method.parameters) {
          if (param.type.includes('Callback') || 
              param.type.includes('Listener') || 
              param.type.includes('Handler') ||
              param.type.toLowerCase().includes('consumer')) {
            
            // Generate callback implementation
            if (param.type.includes('Consumer<')) {
              // Java 8+ functional interface
              const genericType = param.type.substring(param.type.indexOf('<') + 1, param.type.lastIndexOf('>'));
              callbackParams.push(`(${genericType} result) -> {\n            System.out.println("Received: " + result);\n            // Process the result\n        }`);
            } else {
              // Anonymous class implementation
              callbackParams.push(`new ${param.type}() {\n            // Implement callback methods\n            @Override\n            public void onComplete(Result result) {\n                System.out.println("Operation completed: " + result);\n            }\n            \n            @Override\n            public void onError(Exception e) {\n                System.err.println("Error: " + e.getMessage());\n            }\n        }`);
            }
          } else {
            // Regular parameter
            callbackParams.push(this.generateDefaultValue(param.type));
          }
        }
        
        code += `        ${instanceName}.${method.name}(${callbackParams.join(', ')});\n\n`;
      }
    } else {
      // Generic callback example
      code += `        // Example callback usage\n`;
      code += `        ${instanceName}.performAsyncOperation(new ResultCallback() {\n`;
      code += `            @Override\n`;
      code += `            public void onSuccess(Result result) {\n`;
      code += `                System.out.println("Operation succeeded: " + result);\n`;
      code += `            }\n\n`;
      code += `            @Override\n`;
      code += `            public void onFailure(Exception e) {\n`;
      code += `                System.err.println("Operation failed: " + e.getMessage());\n`;
      code += `            }\n`;
      code += `        });\n\n`;
      
      code += `        // Using Java 8+ lambda (if supported)\n`;
      code += `        ${instanceName}.performAsyncOperation(\n`;
      code += `            result -> System.out.println("Success: " + result),\n`;
      code += `            error -> System.err.println("Error: " + error.getMessage())\n`;
      code += `        );\n`;
    }
    
    if (javaClass.isInterface || javaClass.isAbstract) {
      // Add helper method for getting instance
      code += `    }\n\n`;
      code += `    // Helper method to get implementation instance\n`;
      code += `    private static ${fullClassName} get${javaClass.name}Instance() {\n`;
      code += `        // Return an implementation instance\n`;
      code += `        return null; // Replace with actual implementation\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }
  
  /**
   * Generate async/CompletableFuture pattern
   */
  generateAsyncPattern(javaClass: JavaClass): string {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    const instanceName = this.getInstanceName(javaClass.name);
    
    // Look for async methods
    const asyncMethods = javaClass.methods.filter(m => 
      m.returnType.includes('Future') || 
      m.returnType.includes('Mono') || 
      m.returnType.includes('Flux') ||
      m.returnType.includes('Observable') ||
      m.returnType.includes('Promise') ||
      m.name.startsWith('async')
    ).slice(0, 2);
    
    let code = `// Asynchronous programming with ${fullClassName}\n`;
    code += `import ${fullClassName};\n`;
    code += `import java.util.concurrent.CompletableFuture;\n`;
    code += `import java.util.concurrent.ExecutionException;\n\n`;
    
    if (asyncMethods.length === 0) {
      code += `// Note: This is a conceptual example as ${javaClass.name} might not have async methods\n`;
    }
    
    code += `public class ${javaClass.name}AsyncExample {\n`;
    code += `    public static void main(String[] args) {\n`;
    
    // Instance creation
    if (javaClass.isInterface || javaClass.isAbstract) {
      code += `        // Get instance (implementation or through DI)\n`;
      code += `        ${fullClassName} ${instanceName} = get${javaClass.name}Instance();\n\n`;
    } else {
      code += `        // Create instance\n`;
      code += `        ${fullClassName} ${instanceName} = new ${fullClassName}();\n\n`;
    }
    
    if (asyncMethods.length > 0) {
      // Use actual async methods
      code += `        // Asynchronous method calls\n`;
      for (const method of asyncMethods) {
        const params = this.generateMethodParams(method);
        
        code += `        // Call async method\n`;
        code += `        ${method.returnType} future = ${instanceName}.${method.name}(${params});\n\n`;
        
        if (method.returnType.includes('CompletableFuture')) {
          code += `        // Handle CompletableFuture\n`;
          code += `        future.thenAccept(result -> {\n`;
          code += `            System.out.println("Received result: " + result);\n`;
          code += `            // Process the result\n`;
          code += `        }).exceptionally(ex -> {\n`;
          code += `            System.err.println("Error: " + ex.getMessage());\n`;
          code += `            return null;\n`;
          code += `        });\n\n`;
          
          code += `        // Or get the result (blocking)\n`;
          code += `        try {\n`;
          code += `            Object result = future.get();\n`;
          code += `            System.out.println("Result: " + result);\n`;
          code += `        } catch (InterruptedException | ExecutionException e) {\n`;
          code += `            e.printStackTrace();\n`;
          code += `        }\n\n`;
        } else if (method.returnType.includes('Mono') || method.returnType.includes('Flux')) {
          code += `        // Handle reactive types (Project Reactor)\n`;
          code += `        future.subscribe(\n`;
          code += `            result -> System.out.println("Received: " + result),\n`;
          code += `            error -> System.err.println("Error: " + error.getMessage()),\n`;
          code += `            () -> System.out.println("Completed")\n`;
          code += `        );\n\n`;
        } else if (method.returnType.includes('Observable')) {
          code += `        // Handle Observable (RxJava)\n`;
          code += `        future.subscribe(\n`;
          code += `            result -> System.out.println("Received: " + result),\n`;
          code += `            error -> System.err.println("Error: " + error.getMessage()),\n`;
          code += `            () -> System.out.println("Completed")\n`;
          code += `        );\n\n`;
        } else {
          code += `        // Handle Future\n`;
          code += `        try {\n`;
          code += `            Object result = future.get();\n`;
          code += `            System.out.println("Result: " + result);\n`;
          code += `        } catch (InterruptedException | ExecutionException e) {\n`;
          code += `            e.printStackTrace();\n`;
          code += `        }\n\n`;
        }
      }
    } else {
      // Generic async example
      code += `        // Example of asynchronous operations\n`;
      code += `        CompletableFuture<Result> future = ${instanceName}.performAsyncOperation("input");\n\n`;
      
      code += `        // Handle the CompletableFuture\n`;
      code += `        future.thenAccept(result -> {\n`;
      code += `            System.out.println("Received result: " + result);\n`;
      code += `            // Process the result\n`;
      code += `        }).exceptionally(ex -> {\n`;
      code += `            System.err.println("Error: " + ex.getMessage());\n`;
      code += `            return null;\n`;
      code += `        });\n\n`;
      
      code += `        // Chaining operations\n`;
      code += `        CompletableFuture<ProcessedResult> processedFuture = future\n`;
      code += `            .thenApply(result -> new ProcessedResult(result))\n`;
      code += `            .thenCompose(processed -> ${instanceName}.anotherAsyncOperation(processed));\n\n`;
      
      code += `        // Combine multiple futures\n`;
      code += `        CompletableFuture<Result> future2 = ${instanceName}.performAsyncOperation("input2");\n`;
      code += `        CompletableFuture<CombinedResult> combinedFuture = future.thenCombine(\n`;
      code += `            future2,\n`;
      code += `            (result1, result2) -> new CombinedResult(result1, result2)\n`;
      code += `        );\n\n`;
      
      code += `        // Wait for completion (blocking, not recommended for production)\n`;
      code += `        try {\n`;
      code += `            CombinedResult result = combinedFuture.get();\n`;
      code += `            System.out.println("Final result: " + result);\n`;
      code += `        } catch (InterruptedException | ExecutionException e) {\n`;
      code += `            e.printStackTrace();\n`;
      code += `        }\n`;
    }
    
    if (javaClass.isInterface || javaClass.isAbstract) {
      // Add helper method for getting instance
      code += `    }\n\n`;
      code += `    // Helper method to get implementation instance\n`;
      code += `    private static ${fullClassName} get${javaClass.name}Instance() {\n`;
      code += `        // Return an implementation instance\n`;
      code += `        return null; // Replace with actual implementation\n`;
    }
    
    code += `    }\n`;
    code += `}\n`;
    
    return code;
  }

  /**
   * Check if a method is a getter or setter
   */
  private isGetterOrSetter(method: JavaMethod): boolean {
    return (method.name.startsWith('get') || method.name.startsWith('set') || 
            method.name.startsWith('is')) && method.parameters.length <= 1;
  }
  
  /**
   * Check if a class has getter/setter for a field
   */
  private hasGetterSetter(javaClass: JavaClass, fieldName: string): boolean {
    const capitalizedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    return javaClass.methods.some(m => 
      (m.name === `get${capitalizedName}` || m.name === `set${capitalizedName}`) &&
      m.modifiers.includes('public')
    );
  }
  
  /**
   * Get a suitable instance name for a class
   */
  private getInstanceName(className: string): string {
    if (!className) return 'instance';
    return className.charAt(0).toLowerCase() + className.slice(1);
  }
  
  /**
   * Generate default parameter values based on type
   */
  private generateDefaultValue(type: string): string {
    const baseType = type.replace(/<.*>/g, ''); // Remove generics
    
    switch (baseType) {
      case 'int': 
      case 'long': 
      case 'short': 
      case 'byte':
        return '0';
      case 'float': 
      case 'double':
        return '0.0';
      case 'boolean':
        return 'false';
      case 'char':
        return "'a'";
      case 'String':
        return '"example"';
      case 'Integer':
        return 'Integer.valueOf(0)';
      case 'Long':
        return 'Long.valueOf(0L)';
      case 'Double':
        return 'Double.valueOf(0.0)';
      case 'Float':
        return 'Float.valueOf(0.0f)';
      case 'Boolean':
        return 'Boolean.FALSE';
      case 'Character':
        return "Character.valueOf('a')";
      case 'Object':
        return 'new Object()';
      default:
        if (baseType.endsWith('[]')) {
          return 'new ' + baseType + '{}';
        }
        if (baseType.includes('List')) {
          return 'java.util.Collections.emptyList()';
        }
        if (baseType.includes('Map')) {
          return 'java.util.Collections.emptyMap()';
        }
        if (baseType.includes('Set')) {
          return 'java.util.Collections.emptySet()';
        }
        return 'null';
    }
  }
  
  /**
   * Generate parameter values for a method
   */
  private generateMethodParams(method: JavaMethod): string {
    if (!method.parameters || method.parameters.length === 0) {
      return '';
    }
    
    return method.parameters.map(param => {
      return this.generateDefaultValue(param.type);
    }).join(', ');
  }
}