import { EventEmitter } from 'node:events'

export type TopicHandler<TPayload> = (payload: TPayload) => void | Promise<void>

export class TopicEventEmitter<TTopic extends string, TPayload = unknown> {
    private readonly emitter = new EventEmitter()

    addListener(topic: TTopic, handler: TopicHandler<TPayload>): void {
        this.emitter.addListener(topic, handler)
    }

    removeListener(topic: TTopic, handler: TopicHandler<TPayload>): void {
        this.emitter.removeListener(topic, handler)
    }

    emit(topic: TTopic, payload: TPayload): boolean {
        return this.emitter.emit(topic, payload)
    }

    /**
     * Emit an event and await all registered (possibly async) handlers.
     * This ensures message processing completes before the caller continues
     * (e.g. before committing offsets).
     */
    async emitAsync(topic: TTopic, payload: TPayload): Promise<void> {
        const listeners = this.emitter.listeners(topic) as TopicHandler<TPayload>[]
        await Promise.all(listeners.map((handler) => handler(payload)))
    }
}
