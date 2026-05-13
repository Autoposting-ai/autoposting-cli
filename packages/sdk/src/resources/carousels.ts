import { Resource } from '../resource'
import type { Carousel, CreateCarouselParams, GenerateCarouselParams } from '../types/carousels'

export class CarouselsResource extends Resource {
  list(): Promise<Carousel[]> {
    return this.get<Carousel[]>('/carousels')
  }

  retrieve(id: string): Promise<Carousel> {
    return this.get<Carousel>(`/carousels/${id}`)
  }

  create(params?: CreateCarouselParams): Promise<Carousel> {
    return this.post<Carousel>('/carousels', params)
  }

  generate(params: GenerateCarouselParams): Promise<Carousel> {
    return this.post<Carousel>('/carousels/generate', params)
  }

  /** POST /carousels/:id/draft — converts carousel to a post draft */
  draft(id: string): Promise<Carousel> {
    return this.post<Carousel>(`/carousels/${id}/draft`)
  }

  remove(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/carousels/${id}`)
  }
}
