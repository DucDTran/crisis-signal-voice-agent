import { env } from 'cloudflare:workers';

export function serverEnv(name: string) {
  const bindings = env as unknown as Record<string, string | undefined>;
  return bindings[name] ?? process.env[name];
}
