export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    location: string;
  };
}
