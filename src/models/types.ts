export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
  optional?: boolean;
}

export interface MavenProject {
  groupId: string;
  artifactId: string;
  version: string;
  dependencies: MavenDependency[];
}

export interface JavaClass {
  name: string;
  packageName: string;
  isInterface: boolean;
  isAbstract: boolean;
  modifiers: string[];
  methods: JavaMethod[];
  fields: JavaField[];
  superClass?: string;
  interfaces: string[];
  javadoc?: string;
}

export interface JavaMethod {
  name: string;
  returnType: string;
  parameters: JavaParameter[];
  modifiers: string[];
  exceptions: string[];
  javadoc?: string;
  examples?: string[];
}

export interface JavaParameter {
  name: string;
  type: string;
  description?: string;
}

export interface JavaField {
  name: string;
  type: string;
  modifiers: string[];
  javadoc?: string;
}

export interface ApiSearchResult {
  className: string;
  packageName: string;
  methodName?: string;
  snippet?: string;
  relevance: number;
}