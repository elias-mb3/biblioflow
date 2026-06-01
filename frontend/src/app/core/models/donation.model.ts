export interface Donation {
  id: string;
  userId: string;
  bookId?: string;
  title: string;
  author: string;
  createdAt: string;
}

export interface CreateDonationRequest {
  userId: string;
  title: string;
  author: string;
  bookId?: string;
}
