import Resolver from '@forge/resolver';

const resolver = new (Resolver as any)();

resolver.define('getText', (req: { payload: unknown }) => {
  console.log('getText invoked with payload:', req.payload);
  return 'Hello, world!';
});

export const handler = resolver.getDefinitions();
