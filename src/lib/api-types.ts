import type { Customer, Order, OrderItem, Product, Settlement, User } from '@/db/schema';

// API list responses follow a common paginated envelope.
export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerRow extends Customer {
  outstanding: string | null;
  salespersonName: string | null;
}

export interface CustomersResponse extends PaginatedResponse<Customer> {
  customers: CustomerRow[];
}

export interface ProductsResponse extends PaginatedResponse<Product> {
  products: Product[];
}

export interface OrderRow extends Order {
  customer: Customer | null;
  salesperson: User | null;
}

export interface OrdersResponse extends PaginatedResponse<Order> {
  orders: OrderRow[];
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  payments: Settlement[];
  customer: Customer | null;
  salesperson: User | null;
  customerName?: string | null;
  salespersonName?: string | null;
}

export interface Salesperson extends User {
  orderCount?: number;
  totalRevenue?: string | number | null;
  totalCollections?: string | number | null;
  totalCustomers?: number;
}

export interface SalespeopleResponse {
  salespeople: Salesperson[];
}

export interface SettlementsResponse extends PaginatedResponse<Settlement> {
  settlements: Settlement[];
}

export interface DashboardResponse {
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: string | number | null;
  totalCollected: string | number | null;
  pendingSettlements: number;
  recentOrders: OrderRow[];
  [key: string]: unknown;
}

export interface ActivityResponse {
  activities: Array<{
    id: number;
    userId: number | null;
    activityType: string;
    entityType: string | null;
    entityId: number | null;
    description: string;
    metadata: unknown;
    ipAddress: string | null;
    createdAt: Date | string | null;
    user: string | null;
  }>;
}
