import { Static, Type } from '@sinclair/typebox'
import { ApId } from '../../common/id-generator'
import { OtpType } from '../../otp/otp-type'

export const CreateOtpRequestBody = Type.Object({
    email: Type.String(),
    type: Type.Enum(OtpType),
})
export type CreateOtpRequestBody = Static<typeof CreateOtpRequestBody>

export const VerifyEmailRequestBody = Type.Object({
    identityId: ApId,
    otp: Type.String(),
})
export type VerifyEmailRequestBody = Static<typeof VerifyEmailRequestBody>

export const ResetPasswordRequestBody = Type.Object({
    identityId: ApId,
    otp: Type.String(),
    newPassword: Type.String(),
})
export type ResetPasswordRequestBody = Static<typeof ResetPasswordRequestBody>

export const ManagedAuthnRequestBody = Type.Object({
    externalAccessToken: Type.String(),
})
export type ManagedAuthnRequestBody = Static<typeof ManagedAuthnRequestBody>
