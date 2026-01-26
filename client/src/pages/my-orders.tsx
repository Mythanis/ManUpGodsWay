import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { ShoppingBag, Package, Tag, Truck, Check, Clock, X, Coins } from "lucide-react";

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tier: string;
  rationCost: number;
  productType: string;
}

interface StoreRedemption {
  id: string;
  userId: string;
  productId: string;
  rationsCost: number;
  selectedSize: string | null;
  status: string;
  shippingName: string | null;
  trackingNumber: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  product: StoreProduct;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-400", bgColor: "bg-yellow-900/50", label: "Pending" },
  processing: { icon: Package, color: "text-blue-400", bgColor: "bg-blue-900/50", label: "Processing" },
  shipped: { icon: Truck, color: "text-purple-400", bgColor: "bg-purple-900/50", label: "Shipped" },
  delivered: { icon: Check, color: "text-green-400", bgColor: "bg-green-900/50", label: "Delivered" },
  cancelled: { icon: X, color: "text-red-400", bgColor: "bg-red-900/50", label: "Cancelled" },
};

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: orders = [], isLoading } = useQuery<StoreRedemption[]>({
    queryKey: ["/api/store/redemptions"],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-ministry-gold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-background min-h-screen">
      <div className="liquid-header text-white px-4 pt-8 pb-6">
        <BackButton />
        <div className="flex items-center gap-3 mb-4">
          <ShoppingBag className="w-6 h-6" />
          <h1 className="text-2xl font-black uppercase tracking-tighter">My Orders</h1>
        </div>
        <p className="text-sm text-zinc-400">Track your redeemed rations store items</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-ministry-gold">Loading orders...</div>
          </div>
        ) : orders.length === 0 ? (
          <Card className="bg-zinc-900 border-2 border-zinc-700 rounded-sm">
            <CardContent className="p-8 text-center">
              <ShoppingBag className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-white font-bold uppercase mb-2">No Orders Yet</h3>
              <p className="text-zinc-500 text-sm">
                Visit the Rations Store to redeem your earned rations for rewards!
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <Card 
                key={order.id} 
                className="bg-black border-2 border-zinc-700 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded-sm flex items-center justify-center flex-shrink-0">
                      {order.product.productType === "discount_code" ? (
                        <Tag className="w-8 h-8 text-zinc-600" />
                      ) : (
                        <Package className="w-8 h-8 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-bold text-white uppercase text-sm truncate">
                          {order.product.name}
                        </h3>
                        <Badge className={`${statusConfig.bgColor} ${statusConfig.color} text-[10px] font-bold uppercase flex-shrink-0 rounded-sm border border-current`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-ministry-gold" />
                          <span className="text-xs font-bold text-ministry-gold">
                            {order.rationsCost.toLocaleString()}
                          </span>
                        </div>
                        {order.selectedSize && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-xs text-zinc-400 font-bold">
                              Size: {order.selectedSize}
                            </span>
                          </>
                        )}
                        <span className="text-zinc-600">•</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {order.trackingNumber && (
                        <div className="bg-zinc-900 border border-zinc-700 p-2 rounded-sm mt-2">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Tracking Number</p>
                          <p className="text-xs text-white font-mono">{order.trackingNumber}</p>
                        </div>
                      )}

                      {order.product.productType === "discount_code" && order.status === "delivered" && (
                        <div className="bg-green-900/30 border border-green-700 p-2 rounded-sm mt-2">
                          <p className="text-[10px] text-green-400 uppercase font-bold">Code Delivered</p>
                          <p className="text-xs text-green-300">Check your email for the discount code!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
