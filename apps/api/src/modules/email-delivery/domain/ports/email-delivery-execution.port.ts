export const EMAIL_DELIVERY_EXECUTION_PORT = Symbol('EMAIL_DELIVERY_EXECUTION_PORT');

/**
 * The token EmailDeliveryModule owns and exports for its TaskExecutionPort implementation
 * (EmailDeliveryExecutionService). WorkerModule binds its own TASK_EXECUTION_PORT to this token
 * rather than importing EmailDeliveryExecutionService directly — the consumer of an interface
 * shouldn't need to know which concrete class implements it (Architecture Stabilization M24.5).
 * The interface itself is TaskExecutionPort (worker/domain/ports/task-execution.port.ts), which
 * EmailDeliveryExecutionService already implements — this token just lets EmailDeliveryModule
 * publish that implementation under its own name instead of Worker reaching in for the class.
 */
