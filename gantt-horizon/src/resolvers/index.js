import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  console.log('getText invoked with payload:', req.payload);
  return 'Hello, world!';
});

export const handler = resolver.getDefinitions();
