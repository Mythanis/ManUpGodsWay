import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Package, Tag, Crown, ShoppingBag, Truck, Check, X, Loader2, Coins, Upload, Image } from "lucide-react";

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
  createdAt: string;
  updatedAt: string;
}

interface StoreRedemption {
  id: string;
  userId: string;
  productId: string;
  rationCost: number;
  selectedSize: string | null;
  status: string;
  shippingName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  trackingNumber: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  product?: StoreProduct;
  user?: { firstName: string | null; lastName: string | null; email: string | null };
}

const TIER_OPTIONS = [
  { value: "subscriber", label: "Subscriber", color: "bg-[#FCD000]" },
];

const PRODUCT_TYPE_OPTIONS = [
  { value: "discount_code", label: "Discount Code" },
  { value: "physical", label: "Physical Item" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-yellow-600" },
  { value: "processing", label: "Processing", color: "bg-blue-600" },
  { value: "shipped", label: "Shipped", color: "bg-purple-600" },
  { value: "delivered", label: "Delivered", color: "bg-green-600" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-600" },
];

export default function StoreManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<StoreRedemption | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    tier: "subscriber",
    rationCost: 500,
    stock: null as number | null,
    isVipOnly: false,
    productType: "physical",
    discountCode: "",
    discountValue: "",
    hasSizes: false,
    availableSizes: [] as string[],
    isActive: true,
  });
  const [sizesInput, setSizesInput] = useState("");

  const { data: products = [], isLoading: productsLoading } = useQuery<StoreProduct[]>({
    queryKey: ["/api/admin/store/products"],
  });

  const { data: redemptions = [], isLoading: redemptionsLoading } = useQuery<StoreRedemption[]>({
    queryKey: ["/api/admin/store/redemptions"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: typeof productForm) => {
      return await apiRequest("POST", "/api/admin/store/products", data);
    },
    onSuccess: async (product: StoreProduct) => {
      if (selectedImageFile && product.id) {
        await uploadProductImage(product.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      toast({ title: "Success", description: "Product created successfully" });
      resetProductForm();
      setShowProductDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof productForm> }) => {
      return await apiRequest("PUT", `/api/admin/store/products/${id}`, data);
    },
    onSuccess: async (_, variables) => {
      if (selectedImageFile) {
        await uploadProductImage(variables.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      toast({ title: "Success", description: "Product updated successfully" });
      resetProductForm();
      setShowProductDialog(false);
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/store/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      toast({ title: "Success", description: "Product deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRedemptionMutation = useMutation({
    mutationFn: async ({ id, status, trackingNumber }: { id: string; status: string; trackingNumber?: string }) => {
      return await apiRequest("PUT", `/api/admin/store/redemptions/${id}`, { status, trackingNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/redemptions"] });
      toast({ title: "Success", description: "Order updated successfully" });
      setShowFulfillDialog(false);
      setSelectedRedemption(null);
      setTrackingNumber("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      imageUrl: "",
      tier: "subscriber",
      rationCost: 500,
      stock: null,
      isVipOnly: false,
      productType: "physical",
      discountCode: "",
      discountValue: "",
      hasSizes: false,
      availableSizes: [],
      isActive: true,
    });
    setSelectedImageFile(null);
    setImagePreview(null);
    setSizesInput("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProductImage = async (productId: string) => {
    if (!selectedImageFile) return;
    
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImageFile);
      
      const response = await fetch(`/api/admin/store/products/${productId}/upload-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: "Warning", description: "Product created but image upload failed", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeProductImage = async (productId: string) => {
    try {
      await apiRequest("DELETE", `/api/admin/store/products/${productId}/delete-image`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      setImagePreview(null);
      setProductForm({ ...productForm, imageUrl: "" });
      toast({ title: "Success", description: "Image removed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove image", variant: "destructive" });
    }
  };

  const openEditDialog = (product: StoreProduct) => {
    setEditingProduct(product);
    const sizes = product.availableSizes || [];
    setProductForm({
      name: product.name,
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      tier: product.tier,
      rationCost: product.rationCost,
      stock: product.stock,
      isVipOnly: product.isVipOnly ?? false,
      productType: product.productType,
      discountCode: product.discountCode || "",
      discountValue: product.discountValue || "",
      hasSizes: product.hasSizes ?? false,
      availableSizes: sizes,
      isActive: product.isActive ?? true,
    });
    setSelectedImageFile(null);
    setImagePreview(product.imageUrl || null);
    setSizesInput(sizes.join(", "));
    setShowProductDialog(true);
  };

  const handleSubmitProduct = () => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const getTierBadge = (tier: string) => {
    const config = TIER_OPTIONS.find(t => t.value === tier);
    const isSubscriber = config?.value === "subscriber";
    return <Badge className={`${config?.color ?? 'bg-zinc-700'} ${isSubscriber ? 'text-black' : 'text-white'} text-xs font-bold uppercase`}>{config?.label ?? tier}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_OPTIONS.find(s => s.value === status);
    return <Badge className={`${config?.color} text-white text-xs font-bold uppercase`}>{config?.label}</Badge>;
  };

  const pendingRedemptions = redemptions.filter(r => r.status === "pending" || r.status === "processing");
  const completedRedemptions = redemptions.filter(r => r.status === "shipped" || r.status === "delivered");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-ministry-gold" />
          <h2 className="text-lg font-bold text-white">Rations Store Management</h2>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="products" className="data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
            Orders ({pendingRedemptions.length} pending)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-base">Store Products</CardTitle>
              <Button
                size="sm"
                onClick={() => { resetProductForm(); setEditingProduct(null); setShowProductDialog(true); }}
                className="bg-ministry-gold text-black hover:bg-yellow-500 font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-ministry-gold" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No products yet. Add your first product!</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-zinc-400">Product</TableHead>
                        <TableHead className="text-zinc-400">Tier</TableHead>
                        <TableHead className="text-zinc-400">Cost</TableHead>
                        <TableHead className="text-zinc-400">Stock</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} className="border-zinc-700">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                {product.productType === "discount_code" ? (
                                  <Tag className="w-5 h-5 text-zinc-500" />
                                ) : (
                                  <Package className="w-5 h-5 text-zinc-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-white text-sm">{product.name}</p>
                                <p className="text-xs text-zinc-500">{product.productType === "discount_code" ? "Digital" : "Physical"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTierBadge(product.tier)}
                              {product.isVipOnly && (
                                <Badge className="bg-ministry-gold-exact text-black text-xs">Subscribers Only</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-ministry-gold" />
                              <span className="font-bold text-ministry-gold">{product.rationCost.toLocaleString()}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.stock === null ? (
                              <span className="text-zinc-500">Unlimited</span>
                            ) : (
                              <span className={product.stock <= 5 ? "text-orange-400 font-bold" : "text-white"}>
                                {product.stock}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={product.isActive ? "bg-green-600" : "bg-zinc-600"}>
                              {product.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(product)}
                                className="text-zinc-400 hover:text-white"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this product?")) {
                                    deleteProductMutation.mutate(product.id);
                                  }
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Pending Orders ({pendingRedemptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redemptionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-ministry-gold" />
                </div>
              ) : pendingRedemptions.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No pending orders</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-zinc-400">Order</TableHead>
                        <TableHead className="text-zinc-400">Customer</TableHead>
                        <TableHead className="text-zinc-400">Product</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRedemptions.map((redemption) => (
                        <TableRow key={redemption.id} className="border-zinc-700">
                          <TableCell>
                            <div>
                              <p className="text-white text-sm font-mono">#{redemption.id.slice(-8)}</p>
                              <p className="text-xs text-zinc-500">
                                {new Date(redemption.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white text-sm">
                                {redemption.shippingName || redemption.user?.firstName || "Unknown"}
                              </p>
                              <p className="text-xs text-zinc-500">{redemption.shippingEmail || redemption.user?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-white text-sm">{redemption.product?.name || "Unknown Product"}</p>
                          </TableCell>
                          <TableCell>{getStatusBadge(redemption.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => { setSelectedRedemption(redemption); setShowFulfillDialog(true); }}
                              className="bg-ministry-gold text-black hover:bg-yellow-500 text-xs"
                            >
                              Fulfill
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {completedRedemptions.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-700">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Completed Orders ({completedRedemptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700">
                        <TableHead className="text-zinc-400">Order</TableHead>
                        <TableHead className="text-zinc-400">Customer</TableHead>
                        <TableHead className="text-zinc-400">Product</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">Tracking</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedRedemptions.slice(0, 10).map((redemption) => (
                        <TableRow key={redemption.id} className="border-zinc-700">
                          <TableCell>
                            <p className="text-white text-sm font-mono">#{redemption.id.slice(-8)}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-white text-sm">{redemption.shippingName || "N/A"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-white text-sm">{redemption.product?.name || "Unknown"}</p>
                          </TableCell>
                          <TableCell>{getStatusBadge(redemption.status)}</TableCell>
                          <TableCell>
                            <p className="text-zinc-400 text-xs font-mono">{redemption.trackingNumber || "-"}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-zinc-400">Product Name</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter product name"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Description</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="bg-zinc-800 border-zinc-700 text-white"
                placeholder="Enter product description"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-zinc-400">Product Image</Label>
              <div className="mt-2">
                {(imagePreview || productForm.imageUrl) ? (
                  <div className="relative w-full h-32 bg-zinc-800 border border-zinc-700 rounded overflow-hidden">
                    <img 
                      src={imagePreview || productForm.imageUrl} 
                      alt="Product preview" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        if (editingProduct && productForm.imageUrl) {
                          removeProductImage(editingProduct.id);
                        } else {
                          setSelectedImageFile(null);
                          setImagePreview(null);
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 bg-zinc-800 border-2 border-dashed border-zinc-600 rounded cursor-pointer hover:border-ministry-gold transition-colors">
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <span className="text-sm text-zinc-400">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {selectedImageFile && (
                <p className="text-xs text-zinc-500 mt-1">Selected: {selectedImageFile.name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400">Tier</Label>
                <Select
                  value={productForm.tier}
                  onValueChange={(value) => setProductForm({ ...productForm, tier: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {TIER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-400">Product Type</Label>
                <Select
                  value={productForm.productType}
                  onValueChange={(value) => setProductForm({ ...productForm, productType: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400">Ration Cost</Label>
                <Input
                  type="number"
                  value={productForm.rationCost}
                  onChange={(e) => setProductForm({ ...productForm, rationCost: parseInt(e.target.value) || 0 })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-zinc-400">Stock (leave empty for unlimited)</Label>
                <Input
                  type="number"
                  value={productForm.stock === null ? "" : productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value ? parseInt(e.target.value) : null })}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Unlimited"
                  min={0}
                />
              </div>
            </div>
            {productForm.productType === "discount_code" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-400">Discount Code</Label>
                  <Input
                    value={productForm.discountCode}
                    onChange={(e) => setProductForm({ ...productForm, discountCode: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="e.g., MANUP20"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400">Discount Value</Label>
                  <Input
                    value={productForm.discountValue}
                    onChange={(e) => setProductForm({ ...productForm, discountValue: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="e.g., 20% off"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={productForm.isVipOnly}
                  onCheckedChange={(checked) => setProductForm({ ...productForm, isVipOnly: checked })}
                />
                <Label className="text-zinc-400">Subscribers Only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) => setProductForm({ ...productForm, isActive: checked })}
                />
                <Label className="text-zinc-400">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={productForm.hasSizes}
                  onCheckedChange={(checked) => {
                    setProductForm({ ...productForm, hasSizes: checked });
                    if (!checked) {
                      setSizesInput("");
                      setProductForm(prev => ({ ...prev, hasSizes: checked, availableSizes: [] }));
                    }
                  }}
                />
                <Label className="text-zinc-400">Has Sizes</Label>
              </div>
            </div>

            {productForm.hasSizes && (
              <div className="space-y-2">
                <Label className="text-zinc-400">Available Sizes (comma-separated)</Label>
                <Input
                  value={sizesInput}
                  onChange={(e) => {
                    setSizesInput(e.target.value);
                    const sizes = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                    setProductForm({ ...productForm, availableSizes: sizes });
                  }}
                  placeholder="S, M, L, XL, 2XL, 3XL"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
                <p className="text-xs text-zinc-500">Enter sizes separated by commas (e.g., S, M, L, XL)</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowProductDialog(false)} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitProduct}
              disabled={createProductMutation.isPending || updateProductMutation.isPending || !productForm.name}
              className="bg-ministry-gold text-black hover:bg-yellow-500"
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingProduct ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFulfillDialog} onOpenChange={setShowFulfillDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Fulfill Order</DialogTitle>
          </DialogHeader>
          {selectedRedemption && (
            <div className="space-y-4 py-4">
              <Card className="bg-zinc-800 border-zinc-700">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Product:</span>
                    <span className="text-white">{selectedRedemption.product?.name}</span>
                  </div>
                  {selectedRedemption.selectedSize && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Size:</span>
                      <span className="text-white font-bold">{selectedRedemption.selectedSize}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Customer:</span>
                    <span className="text-white">{selectedRedemption.shippingName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Email:</span>
                    <span className="text-white">{selectedRedemption.shippingEmail}</span>
                  </div>
                  {selectedRedemption.shippingAddress && (
                    <>
                      <div className="border-t border-zinc-700 pt-2 mt-2">
                        <p className="text-zinc-400 mb-1">Shipping Address:</p>
                        <p className="text-white">{selectedRedemption.shippingAddress}</p>
                        <p className="text-white">
                          {selectedRedemption.shippingCity}, {selectedRedemption.shippingState} {selectedRedemption.shippingZip}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {selectedRedemption.product?.productType === "physical" && (
                <div>
                  <Label className="text-zinc-400">Tracking Number (optional)</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="Enter tracking number"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => updateRedemptionMutation.mutate({ 
                    id: selectedRedemption.id, 
                    status: "processing" 
                  })}
                  disabled={updateRedemptionMutation.isPending}
                >
                  Mark Processing
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => updateRedemptionMutation.mutate({ 
                    id: selectedRedemption.id, 
                    status: "shipped",
                    trackingNumber: trackingNumber || undefined
                  })}
                  disabled={updateRedemptionMutation.isPending}
                >
                  Mark Shipped
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => updateRedemptionMutation.mutate({ 
                  id: selectedRedemption.id, 
                  status: "cancelled" 
                })}
                disabled={updateRedemptionMutation.isPending}
              >
                Cancel Order
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
