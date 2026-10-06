import { Resource } from '../resource'
import type { Brand, CreateBrandParams, PlatformConnection, UpdateBrandParams } from '../types/brands'

export class BrandsResource extends Resource {
  list(): Promise<Brand[]> {
    return this.get<Brand[]>('/brands')
  }

  retrieve(slug: string): Promise<Brand> {
    return this.get<Brand>(`/brands/${slug}`)
  }

  create(params: CreateBrandParams): Promise<Brand> {
    return this.post<Brand>('/brands', params)
  }

  update(slug: string, params: UpdateBrandParams): Promise<Brand> {
    return this.patch<Brand>(`/brands/${slug}`, params)
  }

  remove(slug: string): Promise<void> {
    return this.delete<void>(`/brands/${slug}`)
  }

  authStatus(slug: string): Promise<PlatformConnection[]> {
    return this.get<PlatformConnection[]>(`/brands/${slug}/auth/status`)
  }

  /** Browser session owns beta checks, official authorization and explicit Page selection. */
  async facebookConnection(slug: string): Promise<{ url: string; brandSlug: string; platform: 'facebook' }> {
    const brand = await this.retrieve(slug)
    const url = new URL('/brands', this.client.baseUrl)
    url.searchParams.set('brand', brand.slug)
    url.searchParams.set('platform', 'facebook')
    return { url: url.toString(), brandSlug: brand.slug, platform: 'facebook' }
  }
}
