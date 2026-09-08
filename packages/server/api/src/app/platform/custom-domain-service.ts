// Community edition: custom domains are an enterprise feature.
export const customDomainService = {
    async getOneByDomain(_params: { domain: string }): Promise<{ platformId: string } | null> {
        return null
    },
}
