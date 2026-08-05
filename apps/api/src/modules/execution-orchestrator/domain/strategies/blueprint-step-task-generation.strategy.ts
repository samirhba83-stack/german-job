import { Injectable } from '@nestjs/common';
import { ExecutionBlueprint } from '../../../execution-planning/domain/execution-blueprint';
import { ExecutionTask } from '../entities/execution-task.entity';
import { TaskGenerationStrategy } from '../ports/task-generation-strategy.port';

/**
 * Default TASK_GENERATION_STRATEGY binding: a direct 1:1 mapping from ExecutionStep to
 * ExecutionTask, preserving id, type, title, explanation, and dependency edges exactly.
 * A step with no dependencies starts READY; every other step starts PENDING until its
 * dependencies resolve (see ExecutionTaskPipeline.resolveReadiness).
 */
@Injectable()
export class BlueprintStepTaskGenerationStrategy implements TaskGenerationStrategy {
  generate(blueprint: ExecutionBlueprint, now: Date): ExecutionTask[] {
    return blueprint.steps.map((step) =>
      ExecutionTask.create(
        step.id,
        step.type,
        step.title,
        step.explanation,
        step.dependsOn,
        step.dependsOn.length === 0 ? 'READY' : 'PENDING',
        blueprint.basedOn.correlationId,
        now,
      ),
    );
  }
}
