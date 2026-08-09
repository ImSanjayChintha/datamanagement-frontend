import PimListPage from '@/modules/pim/components/PimListPage';
import { pimCategoriesApi } from '@/modules/pim/api';

export default function CategoriesListPage() {
  return (
    <PimListPage
      entityCode="categories"
      title="Categories"
      schemaLabel="pim.categories"
      basePath="/pim/categories"
      api={pimCategoriesApi}
      deleteLabel="category"
      newLabel="New category"
    />
  );
}
