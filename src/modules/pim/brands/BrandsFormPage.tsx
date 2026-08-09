import PimFormPage from '@/modules/pim/components/PimFormPage';
import { pimBrandsApi } from '@/modules/pim/api';

export default function BrandsFormPage() {
  return (
    <PimFormPage
      entityCode="brands"
      basePath="/pim/brands"
      newLabel="New brand"
      editLabel="Edit brand"
      api={pimBrandsApi}
      idType="number"
    />
  );
}
