/**
 * Game Engine — Entity Manager
 * Manages entities: add/remove, update, render (sorted by layer), collision detection, pooling.
 */

import type { Entity } from "./types";

export class EntityManager {
  private entities = new Map<string, Entity>();
  private nextId = 0;
  private pool = new Map<string, Entity[]>();

  // ---- ID generation ----

  generateId(prefix = "e"): string {
    return `${prefix}_${this.nextId++}`;
  }

  // ---- CRUD ----

  add(entity: Entity): Entity {
    this.entities.set(entity.id, entity);
    return entity;
  }

  remove(id: string): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.entities.delete(id);
    // Return to pool if it has a matching tag
    for (const tag of entity.tags) {
      const tagPool = this.pool.get(tag);
      if (tagPool) {
        entity.active = false;
        tagPool.push(entity);
        break;
      }
    }
  }

  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  getActive(): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.active) result.push(e);
    }
    return result;
  }

  // ---- Queries ----

  findByTag(tag: string): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (e.active && e.tags.includes(tag)) result.push(e);
    }
    return result;
  }

  findFirst(tag: string): Entity | undefined {
    for (const e of this.entities.values()) {
      if (e.active && e.tags.includes(tag)) return e;
    }
    return undefined;
  }

  count(): number {
    return this.entities.size;
  }

  // ---- Update & Render ----

  update(dt: number): void {
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.update(dt);
      }
    }
  }

  private renderList: Entity[] = [];

  /** Render all active entities sorted by layer (ascending). */
  render(ctx: CanvasRenderingContext2D): void {
    this.renderList.length = 0;
    for (const e of this.entities.values()) {
      if (e.active) this.renderList.push(e);
    }
    this.renderList.sort((a, b) => a.layer - b.layer);
    for (const entity of this.renderList) {
      entity.render(ctx);
    }
  }

  // ---- Collision Detection ----

  /** Simple circle-circle collision between two entities. */
  checkCollision(a: Entity, b: Entity): boolean {
    if (!a.active || !b.active) return false;
    const dist = a.position.distanceTo(b.position);
    return dist < a.collisionRadius + b.collisionRadius;
  }

  /** Find all collisions between entities of two tag groups. */
  findCollisions(tagA: string, tagB: string): Array<[Entity, Entity]> {
    const groupA = this.findByTag(tagA);
    const groupB = this.findByTag(tagB);
    const collisions: Array<[Entity, Entity]> = [];
    for (const a of groupA) {
      for (const b of groupB) {
        if (a.id !== b.id && this.checkCollision(a, b)) {
          collisions.push([a, b]);
        }
      }
    }
    return collisions;
  }

  // ---- Entity Pool ----

  /** Register a pool for a tag (e.g. "bullet"). Entities removed with that tag get recycled. */
  registerPool(tag: string, preAllocate: number = 0, factory?: () => Entity): void {
    if (!this.pool.has(tag)) {
      this.pool.set(tag, []);
    }
    if (factory && preAllocate > 0) {
      const tagPool = this.pool.get(tag)!;
      for (let i = 0; i < preAllocate; i++) {
        const entity = factory();
        entity.active = false;
        tagPool.push(entity);
      }
    }
  }

  /** Get a recycled entity from the pool, or null if pool is empty. */
  getFromPool(tag: string): Entity | null {
    const tagPool = this.pool.get(tag);
    if (!tagPool || tagPool.length === 0) return null;
    const entity = tagPool.pop()!;
    entity.active = true;
    return entity;
  }

  // ---- Cleanup ----

  clear(): void {
    this.entities.clear();
  }

  dispose(): void {
    this.entities.clear();
    this.pool.clear();
    this.renderList.length = 0;
  }
}
