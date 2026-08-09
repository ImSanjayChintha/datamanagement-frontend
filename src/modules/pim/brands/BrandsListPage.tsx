import PimListPage from '@/modules/pim/components/PimListPage';
import { pimBrandsApi } from '@/modules/pim/api';

export default function BrandsListPage() {
  return (
    <PimListPage
      entityCode="brands"
      title="Brands"
      schemaLabel="pim.brands"
      basePath="/pim/brands"
      api={pimBrandsApi}
      deleteLabel="brand"
      newLabel="New brand"
    />
  );
}
