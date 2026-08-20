import { ActionContext, createAction, InputPropertyMap, Property } from '@activepieces/pieces-framework'
import { ExecutionType, PauseType } from '@activepieces/shared'
import {
  getLabelId,
  outboundTextMessage,
  resolveConfig,
  setRedisHash,
  setWorkflowPosition,
  storeUserResponse
} from '../utils/message'

export const askAQuestion = createAction({
  name: 'ask-question',
  displayName: 'Ask a question',
  description: 'Ask a question and handle response with Native Resume and Custom Engine support',

  props: {
    question: Property.LongText({
      displayName: 'Question to Ask',
      required: true,
    }),
    save: Property.Checkbox({
      displayName: 'Save answer',
      required: false,
      defaultValue: false,
    }),
    label: Property.DynamicProperties({
      displayName: 'Label (for saved answer)',
      required: false,
      refreshers: ['save'],
      props: async (propsValue): Promise<InputPropertyMap> => {
        const { save } = propsValue as { save?: boolean }

        if (save === true) {
          return {
            label: Property.ShortText({
              displayName: 'Label',
              required: true,
            }),
          }
        }

        return {}
      },
    }),
  },

  async run(ctx: ActionContext) {
    try {
      const { propsValue, step, executionType } = ctx
      const { question, save, label } = propsValue as {
        question: string
        save?: boolean
        label?: Record<string, any>
      }

      const nodeName = step.name

      const anyCtx = ctx as any
      const triggerCtx = anyCtx.triggerCtx
      const resumePayload = anyCtx.resumePayload

      const payload = triggerCtx?.body
        ? { ...triggerCtx, ...triggerCtx.body }
        : triggerCtx || {}

      let { conversation_id, position, immediate, config, content } = payload

      if (!conversation_id) {
        conversation_id = (propsValue as any).conversation_id
      }

      if (!conversation_id) {
        throw new Error('[ask-question] conversation_id is missing.')
      }

      const hasContent =
        (content && Object.keys(content).length > 0) ||
        (resumePayload && Object.keys(resumePayload).length > 0)

      const isResume =
        executionType === ExecutionType.RESUME ||
        position === nodeName ||
        (immediate === false && hasContent)

      console.log(`[DEBUG] Node: ${nodeName} | isResume: ${isResume} | immediate: ${immediate}`)

      /* =====================
         PHASE 2 — PROCESS ANSWER
         ===================== */

      if (isResume) {
        console.log('[DEBUG] Processing answer')

        const bodySource =
          executionType === ExecutionType.RESUME
            ? resumePayload?.body
            : content

        let userAnswer: string | null = null

        if (bodySource && typeof bodySource === 'object') {
          const values = Object.values(bodySource)
          userAnswer =
            values.find(
              v =>
                (typeof v === 'string' || typeof v === 'number') &&
                v !== ''
            )?.toString() || null
        }

        console.log(`[DEBUG] Extracted answer: ${userAnswer}`)

        if (userAnswer && save === true) {
          const finalLabel =
            typeof label === 'object' ? label['label'] : label

          if (finalLabel) {
            await storeUserResponse(
              conversation_id,
              nodeName,
              String(finalLabel),
              String(userAnswer)
            )

            const verify = await getLabelId(
              conversation_id,
              String(finalLabel).toLowerCase()
            )

            console.log('[DEBUG] Redis verify:', verify)
          }
        }

        await setRedisHash(
          'removeWorkflowPosition',
          conversation_id,
          'position',
          ''
        )

        return {
          answer: userAnswer,
          label: typeof label === 'object' ? label['label'] : label,
          status: 'DONE',
        }
      }

      /* =====================
         PHASE 1 — ASK QUESTION
         ===================== */

      if (immediate !== false) {
        console.log(`[DEBUG] Asking question at ${nodeName}`)

        config = await resolveConfig(config, conversation_id)

        await setWorkflowPosition(
          conversation_id,
          nodeName,
          config || '{}'
        )

        await outboundTextMessage(question, conversation_id)

        ctx.run.pause({
          pauseMetadata: {
            type: PauseType.WEBHOOK,
            response: {
              status: 200,
              body: {
                message: question,
                status: 'AWAITING_USER_INPUT',
                position: nodeName,
                resumeUrl: anyCtx.generateResumeUrl
                  ? anyCtx.generateResumeUrl({ queryParams: {} })
                  : '',
              },
            },
          },
        })

        return { status: 'PAUSED', question }
      }

      console.log('[DEBUG] Skipped')
      return { status: 'SKIPPED' }

    } catch (error) {
      console.error('[ask-question] Error:', error)
      throw error
    }
  },
})
