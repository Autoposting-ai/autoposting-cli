export interface Carousel {
  id: string
  title?: string
  slides: CarouselSlide[]
  status: 'draft' | 'ready'
  createdAt: string
}

export interface CarouselSlide {
  index: number
  text?: string
  imageUrl?: string
}

export interface CreateCarouselParams {
  title?: string
}

export interface GenerateCarouselParams {
  topic: string
  brandSlug?: string
  slideCount?: number
}
