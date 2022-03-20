import { APIChannel, APIGuild, APIRole, APIUser } from '../../dep.ts';

class CacheManager {
  public channels = new Map<string, APIChannel>();
  public roles = new Map<string, APIRole>();
  public guilds = new Map<string, APIGuild>();
  public users = new Map<string, APIUser>();
}

export { CacheManager };
