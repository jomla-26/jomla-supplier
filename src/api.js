/**
 * عميل الواجهة البرمجية المشترك بين تطبيقات جملة الأربعة.
 * يتولى: حفظ التوكن، إرسال الطلبات، وتوحيد رسائل الخطأ العربية.
 */

const BASE_URL = import.meta.env?.VITE_API_URL || "/api";
const TOKEN_KEY = "jomla_token";
const ACTOR_KEY = "jomla_actor";

/* ----------------------------- الجلسة ----------------------------- */

export const session = {
  get token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  get actor() {
    try { return JSON.parse(localStorage.getItem(ACTOR_KEY) || "null"); } catch { return null; }
  },
  save(token, actor) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ACTOR_KEY, JSON.stringify(actor));
    } catch { /* التخزين غير متاح */ }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACTOR_KEY);
    } catch { /* تجاهل */ }
  },
};

/** خطأ قادم من الواجهة البرمجية برسالة عربية جاهزة للعرض */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** يُستدعى عند انتهاء الجلسة ليعيد التطبيق لشاشة الدخول */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = "GET", body, params, signal } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers = { "Content-Type": "application/json" };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "تعذّر الاتصال بالخادم، تحقق من الإنترنت");
  }

  if (res.status === 401) {
    session.clear();
    onUnauthorized();
    throw new ApiError(401, "انتهت الجلسة، يرجى تسجيل الدخول من جديد");
  }

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, payload.error || "حدث خطأ غير متوقع", payload.details);
  }
  return payload;
}

/* ---------------------------- المسارات ---------------------------- */

export const api = {
  /* المصادقة */
  requestOtp: (accountType, phone) =>
    request("/auth/otp/request", { method: "POST", body: { accountType, phone } }),

  verifyOtp: async (accountType, phone, otp) => {
    const data = await request("/auth/otp/verify", {
      method: "POST", body: { accountType, phone, otp },
    });
    session.save(data.token, data.actor);
    return data;
  },

  me: () => request("/auth/me"),
    logout: () => session.clear(),
  registerAccount: (kind, body) => request(`/accounts/${kind}/register`, { method: "POST", body }),

  /* الكتالوج */
  sections: () => request("/catalog/sections"),
  createSection: (body) => request("/catalog/sections", { method: "POST", body }),
  updateSection: (id, body) => request(`/catalog/sections/${id}`, { method: "PATCH", body }),
  suppliers: () => request("/catalog/suppliers"),
  products: (params) => request("/catalog/products", { params }),
  createProduct: (body) => request("/catalog/products", { method: "POST", body }),
  updateProduct: (id, body) => request(`/catalog/products/${id}`, { method: "PATCH", body }),
  productMovement: (id) => request(`/catalog/products/${id}/movement`),
  salesReport: (period) => request("/catalog/products/me/report", { params: { period } }),
  inventoryReport: (params) => request("/catalog/inventory-report", { params }),
  importProducts: (rows, supplierId) => request("/catalog/products/import", { method: "POST", body: { rows, supplierId } }),
  confirmNewImports: (rows, supplierId) => request("/catalog/products/import/confirm-new", { method: "POST", body: { rows, supplierId } }),
  createStockVoucher: (body) => request("/catalog/stock-vouchers", { method: "POST", body }),
  stockVouchers: (params) => request("/catalog/stock-vouchers", { params }),
  stockVoucher: (id) => request(`/catalog/stock-vouchers/${id}`),
  addStockMovement: (productId, body) => request(`/catalog/products/${productId}/stock-movements`, { method: "POST", body }),
  stockHistory: (productId) => request(`/catalog/products/${productId}/stock-movements`),
  stockMovements: (params) => request("/catalog/stock-movements", { params }),

  /* الطلبيات */
  createOrder: (body) => request("/orders", { method: "POST", body }),
  orders: (params) => request("/orders", { params }),
  order: (id) => request(`/orders/${id}`),
  approveOrder: (id, body = {}) => request(`/orders/${id}/approve`, { method: "POST", body }),
  confirmOrderTransfer: (id, amount) => request(`/orders/${id}/confirm-transfer`, { method: "POST", body: { amount } }),
  rejectOrder: (id, body) => request(`/orders/${id}/reject`, { method: "POST", body }),
  setOrderStatus: (id, body) => request(`/orders/${id}/status`, { method: "PATCH", body }),
  setAvailability: (osId, body) =>
    request(`/orders/supplier-parts/${osId}/availability`, { method: "POST", body }),
  resolveShortage: (id, body) => request(`/orders/shortages/${id}/resolve`, { method: "POST", body }),
  assignDriver: (id, driverId) =>
    request(`/orders/${id}/assign-driver`, { method: "POST", body: { driverId } }),
  startDelivery: (id) => request(`/orders/${id}/start-delivery`, { method: "POST" }),
  deliverOrder: (id, collected) =>
    request(`/orders/${id}/deliver`, { method: "POST", body: { collected } }),
  confirmPickup: (osId, paymentReceived) =>
    request(`/orders/supplier-parts/${osId}/pickup-confirm`, { method: "POST", body: { paymentReceived } }),
  markSupplierPartReady: (osId) =>
    request(`/orders/supplier-parts/${osId}/mark-ready`, { method: "POST" }),
  setOrderSupplierCommissionRate: (osId, commissionRate) =>
    request(`/orders/order-suppliers/${osId}/commission-rate`, { method: "PATCH", body: { commissionRate } }),
  bulkOrderStatus: (body) => request("/orders/bulk-status", { method: "PATCH", body }),
  changeFulfillment: (id, body) => request(`/orders/${id}/fulfillment`, { method: "PATCH", body }),
  updateDeliveryFee: (id, body) => request(`/orders/${id}/delivery-fee`, { method: "PATCH", body }),
  adminCreateOrder: (body) => request("/orders/admin-create", { method: "POST", body }),
  addOrderItem: (orderId, body) => request(`/orders/${orderId}/items`, { method: "POST", body }),
  updateOrderItem: (orderId, itemId, body) => request(`/orders/${orderId}/items/${itemId}`, { method: "PATCH", body }),
  removeOrderItem: (orderId, itemId) => request(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" }),

  /* المالية */

vouchers: (params) => request("/finance/vouchers", { params }),
  createVoucher: (body) => request("/finance/vouchers", { method: "POST", body }),
  decideVoucher: (id, body) => request(`/finance/vouchers/${id}/decide`, { method: "POST", body }),
  transfers: (body) => request("/finance/transfers", { method: "POST", body }),
  treasuries: () => request("/finance/treasuries"),
  settleDriver: (id) => request(`/finance/drivers/${id}/settle`, { method: "POST" }),
  driversCash: () => request("/finance/drivers/cash"),
  paySalary: (body) => request("/finance/salaries", { method: "POST", body }),
  customerLedger: (id) => request(`/finance/ledger/customer/${id}`),
  supplierLedger: (id) => request(`/finance/ledger/supplier/${id}`),
  voucherData: (id) => request(`/finance/vouchers/me/${id}`),
  expenses: (params) => request("/finance/expenses", { params }),
  expensesSummary: () => request("/finance/expenses/summary"),
  createExpense: (body) => request("/finance/expenses", { method: "POST", body }),
  profitReport: (params) => request("/finance/profit-report", { params }),

  /* الموظفون */
  employees: (params) => request("/employees", { params }),
  employeeRoles: () => request("/employees/roles"),
  createEmployee: (body) => request("/employees", { method: "POST", body }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: "PATCH", body }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: "DELETE" }),
  employeePermissions: (id) => request(`/employees/${id}/permissions`),
  updateEmployeePermissions: (id, body) => request(`/employees/${id}/permissions`, { method: "PATCH", body }),
  employeeSectionScope: (id) => request(`/employees/${id}/section-scope`),
  updateEmployeeSectionScope: (id, body) => request(`/employees/${id}/section-scope`, { method: "PATCH", body }),

  /* الحسابات (عملاء وموردون) */
  accounts: (kind, params) => request(`/accounts/${kind}`, { params }),
  account: (kind, id) => request(`/accounts/${kind}/${id}`),
  createAccount: (kind, body) => request(`/accounts/${kind}`, { method: "POST", body }),
  updateAccount: (kind, id, body) => request(`/accounts/${kind}/${id}`, { method: "PATCH", body }),
  deleteAccount: (kind, id) => request(`/accounts/${kind}/${id}`, { method: "DELETE" }),
  approveAccount: (kind, id, sectionIds = []) =>
    request(`/accounts/${kind}/${id}/approve`, { method: "POST", body: { sectionIds } }),
  rejectAccount: (kind, id) => request(`/accounts/${kind}/${id}/reject`, { method: "POST" }),
  setAccountSections: (kind, id, sectionIds) =>
    request(`/accounts/${kind}/${id}/sections`, { method: "PATCH", body: { sectionIds } }),
  setCustomerCredit: (id, body) => request(`/accounts/customer/${id}/credit`, { method: "PATCH", body }),
  setSupplierCommissionRate: (id, commissionRate) =>
    request(`/accounts/supplier/${id}/commission-rate`, { method: "PATCH", body: { commissionRate } }),
  auditLogs: (params) => request("/accounts/audit/logs", { params }),

  /* إعدادات التوصيل */
  deliveryZones: () => request("/delivery/zones"),
  createDeliveryZone: (body) => request("/delivery/zones", { method: "POST", body }),
  updateDeliveryZone: (id, body) => request(`/delivery/zones/${id}`, { method: "PATCH", body }),
  vehicleTypes: () => request("/delivery/vehicle-types"),
  createVehicleType: (body) => request("/delivery/vehicle-types", { method: "POST", body }),
  updateVehicleType: (id, body) => request(`/delivery/vehicle-types/${id}`, { method: "PATCH", body }),
  deliveryRates: () => request("/delivery/rates"),
  setDeliveryRate: (body) => request("/delivery/rates", { method: "POST", body }),
  deliverySettings: () => request("/delivery/settings"),
  updateDeliverySettings: (body) => request("/delivery/settings", { method: "PATCH", body }),

  /* الأسعار الخاصة */
  priceRules: (productId) => request(`/catalog/products/${productId}/price-rules`),
  createPriceRule: (productId, body) => request(`/catalog/products/${productId}/price-rules`, { method: "POST", body }),
  togglePriceRule: (id, isActive) => request(`/catalog/price-rules/${id}`, { method: "PATCH", body: { isActive } }),

  /* النواقص */
  orderShortages: (orderId) => request(`/orders/${orderId}/shortages`),
  resolveShortageFull: (id, body) => request(`/orders/shortages/${id}/resolve`, { method: "POST", body }),

  /* إيصال الإغلاق */
  issueReceipt: (orderId) => request(`/orders/${orderId}/receipt`, { method: "POST" }),
  orderReceipts: (orderId) => request(`/orders/${orderId}/receipts`),

  /* الدردشة */

orderMessages: (orderId, orderSupplierId) => request(`/engagement/orders/${orderId}/messages`, { params: { orderSupplierId } }),
  sendOrderMessage: (orderId, body) => request(`/engagement/orders/${orderId}/messages`, { method: "POST", body }),

  /* التقييم والشكاوى */
  submitFeedback: (body) => request("/engagement/feedback", { method: "POST", body }),
  feedbackList: (params) => request("/engagement/feedback", { params }),
  resolveFeedback: (id, body) => request(`/engagement/feedback/${id}/resolve`, { method: "PATCH", body }),

  /* المفضلة */
  favorites: () => request("/engagement/favorites"),
  addFavorite: (productId) => request(`/engagement/favorites/${productId}`, { method: "POST" }),
  removeFavorite: (productId) => request(`/engagement/favorites/${productId}`, { method: "DELETE" }),

  /* الإشعارات */
  notifications: () => request("/engagement/notifications"),
  markNotificationRead: (id) => request(`/engagement/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request("/engagement/notifications/read-all", { method: "POST" }),

  /* المرتجعات */
  createReturn: (body) => request("/engagement/returns", { method: "POST", body }),
  returns: (params) => request("/engagement/returns", { params }),
  setReturnStatus: (id, body) => request(`/engagement/returns/${id}/status`, { method: "PATCH", body }),

  /* الأصول التشغيلية */
  assets: (type) => request("/assets", { params: { type } }),
  createAsset: (body) => request("/assets", { method: "POST", body }),
  assetsSummary: () => request("/assets/summary"),
  addAssetRun: (id, body) => request(`/assets/${id}/runs`, { method: "POST", body }),
  assetRuns: (id) => request(`/assets/${id}/runs`),
  addAssetTrip: (id, body) => request(`/assets/${id}/trips`, { method: "POST", body }),
  assetTrips: (id) => request(`/assets/${id}/trips`),
  addAssetMaintenance: (id, body) => request(`/assets/${id}/maintenance`, { method: "POST", body }),

  /* أداء الموظفين */
  setAttendance: (id, body) => request(`/employees/${id}/attendance`, { method: "POST", body }),
  attendance: (id, params) => request(`/employees/${id}/attendance`, { params }),
  addReview: (id, body) => request(`/employees/${id}/reviews`, { method: "POST", body }),
  reviews: (id) => request(`/employees/${id}/reviews`),

  /* البانرات الترويجية */
  banners: () => request("/banners"),
  adminBanners: () => request("/banners/admin"),
  createBanner: (body) => request("/banners", { method: "POST", body }),
  updateBanner: (id, body) => request(`/banners/${id}`, { method: "PATCH", body }),
  deleteBanner: (id) => request(`/banners/${id}`, { method: "DELETE" }),

  /* رفع الصور — الباك إند يرجّع مسارًا نسبيًا (/uploads/xxx.jpg)، نحوّله هنا لرابط
     كامل لأن الفورمات (مثل إضافة صنف) تتحقق إنه رابط كامل قبل إرساله */
  uploadImage: async (file) => {
    const form = new FormData();
    form.append("image", file);
    const headers = {};
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    const res = await fetch(`${BASE_URL}/uploads/image`, { method: "POST", headers, body: form });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, payload.error || "تعذّر رفع الصورة");
    const origin = new URL(BASE_URL, window.location.origin).origin;
    return { ...payload, url: new URL(payload.url, origin).href };
  },
};
