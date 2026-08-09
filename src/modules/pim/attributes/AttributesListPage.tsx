import PimListPage from '@/modules/pim/components/PimListPage';
import { pimAttributesApi } from '@/modules/pim/api';

export default function AttributesListPage() {
  return (
    <PimListPage
      entityCode="attributes"
      title="Attributes"
      schemaLabel="pim.attributes"
      basePath="/pim/attributes"
      api={pimAttributesApi}
      deleteLabel="attribute"
      newLabel="New attribute"
    />
  );
}
