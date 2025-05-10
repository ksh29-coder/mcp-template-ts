import { ApiSearch } from '../services/api-search.js';
import { JavaClass } from '../models/types.js';

// Mock JavaClass for testing
const createMockJavaClass = (name: string, packageName: string): JavaClass => {
  return {
    name,
    packageName,
    isInterface: false,
    isAbstract: false,
    modifiers: ['public'],
    methods: [
      {
        name: 'doSomething',
        returnType: 'void',
        parameters: [
          { name: 'input', type: 'String' }
        ],
        modifiers: ['public'],
        exceptions: [],
        javadoc: 'This method does something important'
      }
    ],
    fields: [
      {
        name: 'CONSTANT',
        type: 'String',
        modifiers: ['public', 'static', 'final'],
        javadoc: 'A constant value'
      }
    ],
    interfaces: []
  };
};

describe('ApiSearch', () => {
  let apiSearch: ApiSearch;
  
  beforeEach(() => {
    apiSearch = new ApiSearch();
    
    // Add some mock classes to the index
    const class1 = createMockJavaClass('StringUtils', 'org.apache.commons.lang3');
    const class2 = createMockJavaClass('FileUtils', 'org.apache.commons.io');
    const class3 = createMockJavaClass('MapUtils', 'org.apache.commons.collections4');
    
    apiSearch.addClassToIndex(class1);
    apiSearch.addClassToIndex(class2);
    apiSearch.addClassToIndex(class3);
  });
  
  test('should find classes by name', () => {
    const results = apiSearch.searchClasses('Utils');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.name === 'StringUtils')).toBeTruthy();
    expect(results.some(c => c.name === 'FileUtils')).toBeTruthy();
    expect(results.some(c => c.name === 'MapUtils')).toBeTruthy();
  });
  
  test('should find classes by package', () => {
    const results = apiSearch.searchClasses('apache.commons');
    expect(results.length).toBeGreaterThan(0);
  });
  
  test('should find methods by name', () => {
    const results = apiSearch.searchMethods('doSomething');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].methodName).toBe('doSomething');
  });
  
  test('should get class details by name', () => {
    const classInfo = apiSearch.getClassByFullName('org.apache.commons.lang3.StringUtils');
    expect(classInfo).not.toBeUndefined();
    expect(classInfo?.name).toBe('StringUtils');
    expect(classInfo?.packageName).toBe('org.apache.commons.lang3');
  });
});