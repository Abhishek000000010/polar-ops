import mongoose, { Schema, Document, ClientSession } from 'mongoose';
import { EntityType, EdgeRelation } from '@polar-ops/shared';

export interface IDependencyEdge extends Document {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  relationType: EdgeRelation;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const DependencyEdgeSchema = new Schema<IDependencyEdge>({
  sourceType: { type: String, required: true, index: true },
  sourceId: { type: String, required: true, index: true },
  targetType: { type: String, required: true, index: true },
  targetId: { type: String, required: true, index: true },
  relationType: { type: String, required: true, index: true },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

DependencyEdgeSchema.index({ sourceType: 1, sourceId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const EdgeModel = mongoose.model<IDependencyEdge>('DependencyEdge', DependencyEdgeSchema);

/**
 * RULE 2: Link things when you create them.
 * e.g. link('MISSION', missionId, 'CRATE', crateId, 'NEEDS_CRATE')
 */
export async function link(
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  relationType: EdgeRelation,
  metadata?: Record<string, any>,
  session?: ClientSession
): Promise<IDependencyEdge> {
  const edge = await EdgeModel.findOneAndUpdate(
    { sourceType, sourceId, targetType, targetId },
    { sourceType, sourceId, targetType, targetId, relationType, metadata },
    { upsert: true, new: true, session }
  );
  return edge;
}

export async function unlink(
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  session?: ClientSession
) {
  return EdgeModel.deleteOne({ sourceType, sourceId, targetType, targetId }, { session });
}

export async function unlinkAllFromSource(sourceType: EntityType, sourceId: string, session?: ClientSession) {
  return EdgeModel.deleteMany({ sourceType, sourceId }, { session });
}

/**
 * Traverses forward: what does this entity depend on?
 */
export async function getOutgoingDependencies(sourceType: EntityType, sourceId: string) {
  return EdgeModel.find({ sourceType, sourceId }).lean();
}

/**
 * Traverses backward: what other entities depend on this entity?
 * (The core engine for the Ripple Effect View!)
 */
export async function getIncomingDependents(targetType: EntityType, targetId: string) {
  return EdgeModel.find({ targetType, targetId }).lean();
}

export interface RippleNode {
  type: EntityType;
  id: string;
  depth: number;
  relationType: EdgeRelation | string;
}

export interface RippleResult {
  affectedNodes: RippleNode[];
  mitigations: Array<{
    personId: string;
    personName?: string;
    standbyId: string;
    standbyName?: string;
    standbyReady?: boolean;
    availableAction: string;
  }>;
}

/**
 * Computes cascading ripple effects across multiple degrees of separation.
 */
export async function computeRippleEffect(entityType: EntityType, entityId: string, maxDepth = 3): Promise<RippleResult> {
  const visited = new Set<string>();
  const queue: Array<{ type: EntityType; id: string; depth: number; relationType?: string }> = [
    { type: entityType, id: entityId, depth: 0 }
  ];
  const affectedNodes: RippleNode[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.type}:${current.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (current.depth > 0) {
      affectedNodes.push({
        type: current.type,
        id: current.id,
        depth: current.depth,
        relationType: current.relationType || 'DEPENDENT'
      });
    }

    if (current.depth < maxDepth) {
      // Find what depends on this entity (incoming edges)
      const dependents = await getIncomingDependents(current.type, current.id);
      for (const dep of dependents) {
        // A5: Do not traverse BACKUP_FOR edges
        if (dep.relationType === 'BACKUP_FOR') {
          continue;
        }

        queue.push({
          type: dep.sourceType as EntityType,
          id: dep.sourceId,
          depth: current.depth + 1,
          relationType: dep.relationType
        });
      }

      // If entity is a MISSION, also traverse what it requires (outgoing dependencies)
      if (current.type === 'MISSION') {
        const outDeps = await getOutgoingDependencies(current.type, current.id);
        for (const out of outDeps) {
          if (out.relationType === 'BACKUP_FOR') {
            continue;
          }

          queue.push({
            type: out.targetType as EntityType,
            id: out.targetId,
            depth: current.depth + 1,
            relationType: out.relationType
          });
        }
      }
    }
  }

  // A5: Mitigations = backups found for affected people
  const mitigations: RippleResult['mitigations'] = [];
  const affectedPersonIds = affectedNodes.filter(n => n.type === 'PERSON').map(n => n.id);

  if (affectedPersonIds.length > 0) {
    const { PersonModel } = await import('../modules/people/model');
    const people = await PersonModel.find({ _id: { $in: affectedPersonIds } }).lean();

    for (const p of people) {
      if (p.standbyPersonId) {
        const standby = await PersonModel.findById(p.standbyPersonId).lean();
        if (standby) {
          const isReady = Boolean(
            standby.readiness?.medicalCleared &&
            standby.readiness?.auliTrainingCompleted &&
            standby.readiness?.passportValid &&
            standby.readiness?.polarPermitIssued
          );
          mitigations.push({
            personId: p._id.toString(),
            personName: p.name,
            standbyId: standby._id.toString(),
            standbyName: standby.name,
            standbyReady: isReady,
            availableAction: `One-Click Standby Swap available: Replace with certified ${standby.name} (${standby.role})`
          });
        }
      }
    }
  }

  return { affectedNodes, mitigations };
}

export async function getAllEdges() {
  return EdgeModel.find().lean();
}
