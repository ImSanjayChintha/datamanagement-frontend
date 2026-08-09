import PimFormPage from '@/modules/pim/components/PimFormPage';
import { pimCategoriesApi } from '@/modules/pim/api';

export default function CategoriesFormPage() {
  return (
    <PimFormPage
      entityCode="categories"
      basePath="/pim/categories"
      newLabel="New category"
      editLabel="Edit category"
      api={pimCategoriesApi}
      idType="number"
    />
  );
}
