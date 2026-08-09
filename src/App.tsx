import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/core/auth';
import LoginPage from '@/modules/auth/LoginPage';
import ChangePasswordPage from '@/modules/auth/ChangePasswordPage';
import Layout from '@/components/layout/Layout';
import AppHomePage from '@/modules/home/AppHomePage';
import LegalPage from '@/modules/legal/LegalPage';
import ToolkitHomePage from '@/modules/toolkit/home/ToolkitHomePage';
import ToolkitAppLayout from '@/modules/toolkit/layout/ToolkitAppLayout';
import ToolkitLayout from '@/modules/toolkit/layout/ToolkitLayout';
import TableBuilderPage from '@/modules/toolkit/tables/TableBuilderPage';
import DataListPage from '@/modules/toolkit/data/DataListPage';
import DataFormPage from '@/modules/toolkit/data/DataFormPage';
import SqlConsolePage from '@/modules/toolkit/sql/SqlConsolePage';
import CommonFieldsPage from '@/modules/toolkit/fields/CommonFieldsPage';
import CommonFieldsTranslationPage from '@/modules/toolkit/fields/CommonFieldsTranslationPage';
import PageDefsListPage from '@/modules/page-manager/page-defs/PageDefsListPage';
import PageDefFormPage  from '@/modules/page-manager/page-defs/PageDefFormPage';
import DynamicPimListPage from '@/modules/pim/DynamicPimListPage';
import DynamicPimFormPage from '@/modules/pim/DynamicPimFormPage';
import CategoryTreePage from '@/modules/pim/categories/CategoryTreePage';
import FamilyAttributesPage from '@/modules/pim/family-attributes/FamilyAttributesPage';
import AttributeFormPage    from '@/modules/pim/attributes/AttributeFormPage';
import ProductsListPage    from '@/modules/pim/products/ProductsListPage';
import ProductFormPage     from '@/modules/pim/products/ProductFormPage';
import ProductVariantsPage from '@/modules/pim/products/ProductVariantsPage';
import EndpointsPage from '@/modules/api-manager/endpoints/EndpointsPage';
import EndpointFormPage from '@/modules/api-manager/endpoints/EndpointFormPage';
import ResourcesListPage from '@/modules/api-manager/resources/ResourcesListPage';
import ResourceFormPage from '@/modules/api-manager/resources/ResourceFormPage';
import DestinationsPage from '@/modules/api-manager/push/DestinationsPage';

const GatewayDocsPage       = lazy(() => import('@/modules/api-manager/endpoints/GatewayDocsPage'));
const GatewayDocDetailPage  = lazy(() => import('@/modules/api-manager/endpoints/GatewayDocDetailPage'));
const GatewaySwaggerPage    = lazy(() => import('@/modules/api-manager/endpoints/GatewaySwaggerPage'));
const GatewayOpenApiPage    = lazy(() => import('@/modules/api-manager/endpoints/GatewayOpenApiPage'));
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, mustChangePassword } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { token, mustChangePassword } = useAuthStore();
  if (token && !mustChangePassword) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/legal/:page" element={<LegalPage />} />

      {/* Platform shell — Home and future module pages */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<AppHomePage />} />
      </Route>

      {/* Toolkit shell — own sidebar with toolkit-specific nav */}
      <Route element={<RequireAuth><ToolkitAppLayout /></RequireAuth>}>
        <Route path="/toolkit" element={<ToolkitHomePage />} />
        <Route path="/toolkit/tables" element={<ToolkitLayout />}>
          <Route index element={<div />} />
          <Route path="new" element={<TableBuilderPage key="new" />} />
          <Route path=":tableCode/edit" element={<TableBuilderPage />} />
          <Route path=":tableCode/data" element={<DataListPage />} />
          <Route path=":tableCode/data/new" element={<DataFormPage />} />
          <Route path=":tableCode/data/:id/edit" element={<DataFormPage />} />
        </Route>
        <Route path="/toolkit/sql" element={<SqlConsolePage />} />

        {/* Toolkit — Common Fields */}
        <Route path="/toolkit/common-fields" element={<CommonFieldsPage />} />
        <Route path="/toolkit/common-fields/translations" element={<CommonFieldsTranslationPage />} />

        {/* Toolkit — Page Definitions */}
        <Route path="/toolkit/page-defs"              element={<PageDefsListPage />} />
        <Route path="/toolkit/page-defs/new"          element={<PageDefFormPage key="new" />} />
        <Route path="/toolkit/page-defs/:code/edit"   element={<PageDefFormPage />} />

        {/* PIM — special pages (must be before the dynamic catch-all) */}
        <Route path="/pim/attributes/new"          element={<AttributeFormPage key="new" />} />
        <Route path="/pim/attributes/:id/edit"     element={<AttributeFormPage />} />
        <Route path="/pim/categories"              element={<CategoryTreePage />} />
        <Route path="/pim/family_attributes"       element={<FamilyAttributesPage />} />
        <Route path="/pim/products"                element={<ProductsListPage />} />
        <Route path="/pim/products/new"            element={<ProductFormPage key="new" />} />
        <Route path="/pim/products/:id/edit"       element={<ProductFormPage />} />
        <Route path="/pim/product_variants"        element={<ProductVariantsPage />} />

        {/* PIM — all other pages driven by page definitions */}
        <Route path="/pim/:pageDefCode"              element={<DynamicPimListPage />} />
        <Route path="/pim/:pageDefCode/new"          element={<DynamicPimFormPage />} />
        <Route path="/pim/:pageDefCode/:id/edit"     element={<DynamicPimFormPage />} />

        {/* Push Destinations */}
        <Route path="/destinations" element={<DestinationsPage />} />

        {/* API Bridge — resource connections */}
        <Route path="/api-bridge/resources"          element={<ResourcesListPage />} />
        <Route path="/api-bridge/resources/new"      element={<ResourceFormPage />} />
        <Route path="/api-bridge/resources/:id/edit" element={<ResourceFormPage />} />

        {/* Gateway — API endpoint builder */}
        <Route path="/gateway/endpoints"          element={<EndpointsPage />} />
        <Route path="/gateway/endpoints/new"      element={<EndpointFormPage />} />
        <Route path="/gateway/endpoints/:id/edit" element={<EndpointFormPage />} />

        {/* Gateway — docs (inside layout so sidebar stays visible) */}
        <Route path="/gateway/docs"     element={<Suspense fallback={null}><GatewayDocsPage /></Suspense>} />
        <Route path="/gateway/docs/:id" element={<Suspense fallback={null}><GatewayDocDetailPage /></Suspense>} />
        <Route path="/gateway/swagger" element={<Suspense fallback={null}><GatewaySwaggerPage /></Suspense>} />
        <Route path="/gateway/openapi" element={<Suspense fallback={null}><GatewayOpenApiPage /></Suspense>} />

      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
