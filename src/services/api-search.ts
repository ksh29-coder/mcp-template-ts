import { JavaClass, JavaMethod, ApiSearchResult } from '../models/types.js';

export class ApiSearch {
  private classIndex: Map<string, JavaClass> = new Map();
  private methodIndex: Map<string, { className: string, method: JavaMethod }> = new Map();
  private invocationExamples: Map<string, string[]> = new Map();

  /**
   * Add a class to the search index
   */
  addClassToIndex(javaClass: JavaClass): void {
    const fullClassName = `${javaClass.packageName}.${javaClass.name}`;
    this.classIndex.set(fullClassName, javaClass);
    
    // Index methods
    for (const method of javaClass.methods) {
      // Skip private methods
      if (method.modifiers.includes('private')) {
        continue;
      }
      
      const methodKey = `${fullClassName}#${method.name}`;
      this.methodIndex.set(methodKey, { className: fullClassName, method });
    }
  }

  /**
   * Add an invocation example for a method
   */
  addInvocationExample(className: string, methodName: string, example: string): void {
    const key = `${className}#${methodName}`;
    let examples = this.invocationExamples.get(key) || [];
    examples.push(example);
    this.invocationExamples.set(key, examples);
  }

  /**
   * Search for classes by name or pattern
   */
  searchClasses(query: string): JavaClass[] {
    const results: JavaClass[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [className, classInfo] of this.classIndex.entries()) {
      // Match by class name
      if (className.toLowerCase().includes(lowerQuery)) {
        results.push(classInfo);
        continue;
      }
      
      // Match by javadoc
      if (classInfo.javadoc && classInfo.javadoc.toLowerCase().includes(lowerQuery)) {
        results.push(classInfo);
        continue;
      }
    }
    
    return results;
  }

  /**
   * Search for methods by name, return type, or pattern
   */
  searchMethods(query: string): ApiSearchResult[] {
    const results: ApiSearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [methodKey, { className, method }] of this.methodIndex.entries()) {
      let relevance = 0;
      const classInfo = this.classIndex.get(className);
      
      if (!classInfo) continue;
      
      // Match by method name
      if (method.name.toLowerCase().includes(lowerQuery)) {
        relevance += 3;
      }
      
      // Match by return type
      if (method.returnType.toLowerCase().includes(lowerQuery)) {
        relevance += 1;
      }
      
      // Match by parameter types or names
      for (const param of method.parameters) {
        if (param.type.toLowerCase().includes(lowerQuery)) {
          relevance += 1;
        }
        if (param.name.toLowerCase().includes(lowerQuery)) {
          relevance += 0.5;
        }
      }
      
      // Match by javadoc
      if (method.javadoc && method.javadoc.toLowerCase().includes(lowerQuery)) {
        relevance += 2;
        
        // If exact phrase match, boost relevance
        if (method.javadoc.toLowerCase().includes(` ${lowerQuery} `)) {
          relevance += 1;
        }
      }
      
      if (relevance > 0) {
        // Get example usage if available
        const examples = this.invocationExamples.get(methodKey) || [];
        let snippet = '';
        
        if (examples.length > 0) {
          snippet = examples[0];
        } else {
          // Generate a simple example
          snippet = this.generateMethodExample(classInfo, method);
        }
        
        results.push({
          className: classInfo.name,
          packageName: classInfo.packageName,
          methodName: method.name,
          snippet,
          relevance
        });
      }
    }
    
    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get class info by full name
   */
  getClassByFullName(fullClassName: string): JavaClass | undefined {
    return this.classIndex.get(fullClassName);
  }

  /**
   * Get method info by class name and method name
   */
  getMethodInfo(className: string, methodName: string): JavaMethod | undefined {
    const key = `${className}#${methodName}`;
    const methodInfo = this.methodIndex.get(key);
    return methodInfo?.method;
  }

  /**
   * Get example usages for a method
   */
  getMethodExamples(className: string, methodName: string): string[] {
    const key = `${className}#${methodName}`;
    return this.invocationExamples.get(key) || [];
  }

  /**
   * Generate a simple example for a method invocation
   */
  private generateMethodExample(classInfo: JavaClass, method: JavaMethod): string {
    const isStatic = method.modifiers.includes('static');
    let instance = '';
    
    if (!isStatic) {
      instance = `${classInfo.name.charAt(0).toLowerCase()}${classInfo.name.slice(1)}`;
    }
    
    // Generate parameter values based on type
    const paramValues = method.parameters.map(param => {
      const type = param.type.replace(/<.*>/g, ''); // Remove generics
      
      switch (type) {
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
        default:
          if (type.endsWith('[]')) {
            return 'new ' + type + '{}';
          }
          return 'null';
      }
    });
    
    const paramsStr = paramValues.join(', ');
    
    if (isStatic) {
      return `${classInfo.packageName}.${classInfo.name}.${method.name}(${paramsStr});`;
    } else {
      return `${classInfo.packageName}.${classInfo.name} ${instance} = new ${classInfo.packageName}.${classInfo.name}(/* constructor params */);
${instance}.${method.name}(${paramsStr});`;
    }
  }
}