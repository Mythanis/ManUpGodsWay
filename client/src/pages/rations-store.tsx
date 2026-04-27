import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import { Coins, ShoppingBag, Tag, Gift, Crown, Check, Loader2, ClipboardList } from "lucide-react";

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tier: string;
  rationCost: number;
  stock: number | null;
  isVipOnly: boolean;
  productType: string;
  discountCode: string | null;
  discountValue: string | null;
  hasSizes: boolean | null;
  availableSizes: string[] | null;
  isActive: boolean;
}

interface RationsInfo {
  balance: number;
  rank: string;
  rankLabel: string;
}

interface ShippingInfo {
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
}


export default function RationsStorePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    shippingName: "",
    shippingEmail: "",
    shippingPhone: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
  });
  const [selectedSize, setSelectedSize] = useState<string>("");

  const { data: rations } = useQuery<RationsInfo>({
    queryKey: ["/api/rations"],
  });

  const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
    queryKey: ["/api/store/products"],
  });

  const redeemMutation = useMutation({
    mutationFn: async ({ productId, shippingInfo, selectedSize }: { productId: string; shippingInfo?: ShippingInfo; selectedSize?: string }) => {
      return await apiRequest("POST", "/api/store/redeem", { productId, shippingInfo, selectedSize });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/redemptions"] });
      setShowRedeemDialog(false);
      setShowSuccessDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRedeem = (product: StoreProduct) => {
    setSelectedProduct(product);
    setSelectedSize("");
    if (product.productType === "physical") {
      setShippingInfo({
        shippingName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "",
        shippingEmail: user?.email || "",
        shippingPhone: "",
        shippingAddress: "",
        shippingCity: "",
        shippingState: "",
        shippingZip: "",
      });
    }
    setShowRedeemDialog(true);
  };

  const confirmRedeem = () => {
    if (!selectedProduct) return;
    
    if (selectedProduct.hasSizes && selectedProduct.availableSizes?.length && !selectedSize) {
      toast({
        title: "Please select a size",
        description: "You must select a size before redeeming this product.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedProduct.productType === "physical") {
      redeemMutation.mutate({ 
        productId: selectedProduct.id, 
        shippingInfo,
        selectedSize: selectedProduct.hasSizes ? selectedSize : undefined
      });
    } else {
      redeemMutation.mutate({ 
        productId: selectedProduct.id,
        selectedSize: selectedProduct.hasSizes ? selectedSize : undefined
      });
    }
  };

  const userBalance = rations?.balance || 0;
  const isSubscriber = (user as any)?.subscriptionStatus === 'active' ||
    (user as any)?.subscriptionStatus === 'trial' ||
    ((user as any)?.subscriptionStatus === 'cancelled' && (user as any)?.subscriptionExpiresAt && new Date((user as any).subscriptionExpiresAt) > new Date());

  const renderProductCard = (product: StoreProduct) => {
    const canAfford = userBalance >= product.rationCost;
    const meetsVipRequirement = !product.isVipOnly || isSubscriber;
    const inStock = product.stock === null || product.stock > 0;
    const canRedeem = canAfford && meetsVipRequirement && inStock;

    return (
      <Card 
        key={product.id} 
        className="bg-black border-2 border-zinc-700 rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,0.3)] hover:shadow-[6px_6px_0px_0px_rgba(253,208,0,0.4)] transition-all"
      >
        <CardContent className="p-4">
          {product.imageUrl ? (
            <div className="w-full h-32 mb-3 bg-zinc-900 border border-zinc-700 rounded-sm overflow-hidden">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-32 mb-3 bg-zinc-900 border border-zinc-700 rounded-sm flex items-center justify-center">
              {product.productType === "discount_code" ? (
                <Tag className="w-12 h-12 text-zinc-600" />
              ) : (
                <Gift className="w-12 h-12 text-zinc-600" />
              )}
            </div>
          )}

          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-white uppercase tracking-tight text-sm line-clamp-2">{product.name}</h3>
            {product.isVipOnly && (
              <Badge className="bg-ministry-gold text-black text-[10px] font-bold uppercase ml-2 flex-shrink-0 rounded-sm">
                Subscribers Only
              </Badge>
            )}
          </div>

          {product.description && (
            <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{product.description}</p>
          )}

          {product.discountValue && (
            <Badge className="bg-green-900 text-green-400 text-xs mb-3 rounded-sm border border-green-700">
              {product.discountValue}
            </Badge>
          )}

          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-ministry-gold" />
              <span className="font-black text-ministry-gold">{product.rationCost.toLocaleString()}</span>
            </div>

            {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
              <span className="text-[10px] text-orange-400 font-bold uppercase">Only {product.stock} left</span>
            )}
          </div>

          <Button
            onClick={() => handleRedeem(product)}
            disabled={!canRedeem || redeemMutation.isPending}
            className={`w-full mt-3 rounded-sm font-bold uppercase tracking-wide ${
              canRedeem
                ? "bg-ministry-gold text-black hover:bg-yellow-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "bg-zinc-800 text-zinc-500 border-2 border-zinc-700"
            }`}
          >
            {!inStock ? (
              "Out of Stock"
            ) : !meetsVipRequirement ? (
              "Warrior Only"
            ) : !canAfford ? (
              `Need ${(product.rationCost - userBalance).toLocaleString()} more`
            ) : (
              "Redeem"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="pb-20 bg-background min-h-screen">
      <div className="liquid-header text-white px-4 pt-8 pb-6">
        <BackButton />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6" />
            <h1 className="text-2xl font-black uppercase tracking-tighter">Rations Store</h1>
          </div>
          <Link href="/my-orders">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-black/50 border-2 border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black rounded-sm font-bold uppercase text-xs"
            >
              <ClipboardList className="w-4 h-4 mr-1" />
              My Orders
            </Button>
          </Link>
        </div>

        <Card className="bg-black/50 border-2 border-ministry-gold rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 border-2 border-black rounded-sm flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Coins className="w-6 h-6 text-black" />
                </div>
                <div>
                  <p className="text-2xl font-black text-ministry-gold tracking-tight">
                    {userBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-400 uppercase font-bold tracking-wide">
                    Available Rations
                  </p>
                </div>
              </div>
              {isSubscriber && (
                <Badge className="bg-ministry-gold text-black font-bold uppercase rounded-sm border-2 border-black">
                  <Crown className="w-3 h-3 mr-1" />
                  Subscriber
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-ministry-gold" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Crown className="w-16 h-16 text-ministry-gold mb-4 opacity-50" />
            <h3 className="text-white font-bold uppercase mb-2">No Products Available</h3>
            <p className="text-zinc-500 text-sm">Check back soon for new rewards!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(renderProductCard)}
          </div>
        )}
      </div>

      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="bg-black border-2 border-ministry-gold rounded-sm max-w-sm">
          <DialogClose className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-black border-2 border-white rounded-sm text-white hover:bg-zinc-800">
            ✕
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase">Confirm Redemption</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to redeem this item?
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="py-4">
              <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-sm mb-4">
                <h4 className="font-bold text-white uppercase mb-2">{selectedProduct.name}</h4>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-ministry-gold" />
                  <span className="font-black text-ministry-gold">{selectedProduct.rationCost.toLocaleString()} rations</span>
                </div>
              </div>

              {selectedProduct.hasSizes && selectedProduct.availableSizes && selectedProduct.availableSizes.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs text-zinc-400 uppercase font-bold mb-2 block">Select Size</Label>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 rounded-sm text-white">
                      <SelectValue placeholder="Choose a size" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 rounded-sm">
                      {selectedProduct.availableSizes.map((size) => (
                        <SelectItem key={size} value={size} className="text-white hover:bg-zinc-800">
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedProduct.productType === "physical" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 uppercase font-bold">Shipping Information</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-zinc-400">Full Name</Label>
                      <Input
                        value={shippingInfo.shippingName}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingName: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-zinc-400">Email</Label>
                      <Input
                        type="email"
                        value={shippingInfo.shippingEmail}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingEmail: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-zinc-400">Phone</Label>
                      <Input
                        type="tel"
                        value={shippingInfo.shippingPhone}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingPhone: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-zinc-400">Address</Label>
                      <Input
                        value={shippingInfo.shippingAddress}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingAddress: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-400">City</Label>
                      <Input
                        value={shippingInfo.shippingCity}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingCity: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-400">State</Label>
                      <Input
                        value={shippingInfo.shippingState}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingState: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="TX"
                        maxLength={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-zinc-400">ZIP Code</Label>
                      <Input
                        value={shippingInfo.shippingZip}
                        onChange={(e) => setShippingInfo({...shippingInfo, shippingZip: e.target.value})}
                        className="bg-zinc-900 border-zinc-700 rounded-sm text-white"
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-zinc-900 border border-zinc-700 rounded-sm">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Your balance:</span>
                  <span className="text-white font-bold">{userBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Cost:</span>
                  <span className="text-red-400 font-bold">-{selectedProduct.rationCost.toLocaleString()}</span>
                </div>
                <div className="border-t border-zinc-700 mt-2 pt-2 flex justify-between">
                  <span className="text-zinc-400">After redemption:</span>
                  <span className="text-ministry-gold font-bold">
                    {(userBalance - selectedProduct.rationCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRedeemDialog(false)}
              className="rounded-sm border-2 border-zinc-600 text-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRedeem}
              disabled={redeemMutation.isPending}
              className="bg-ministry-gold text-black font-bold uppercase rounded-sm border-2 border-black hover:bg-yellow-500"
            >
              {redeemMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-black border-2 border-ministry-gold rounded-sm max-w-sm">
          <DialogClose className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center bg-black border-2 border-white rounded-sm text-white hover:bg-zinc-800">
            ✕
          </DialogClose>
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 bg-green-900 border-2 border-green-500 rounded-sm flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-xl font-black text-white uppercase mb-2">Success!</h3>
            <p className="text-zinc-400 text-center text-sm">
              {selectedProduct?.productType === "discount_code"
                ? "Your discount code will be sent to your email shortly!"
                : "Your order has been placed! We'll notify you when it ships."}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full bg-ministry-gold text-black font-bold uppercase rounded-sm border-2 border-black hover:bg-yellow-500"
            >
              Continue Shopping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
