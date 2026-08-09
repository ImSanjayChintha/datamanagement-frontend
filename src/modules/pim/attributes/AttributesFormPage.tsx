import PimFormPage from '@/modules/pim/components/PimFormPage';
import { pimAttributesApi } from '@/modules/pim/api';

export default function AttributesFormPage() {
  return (
    <PimFormPage
      entityCode="attributes"
      basePath="/pim/attributes"
      newLabel="New attribute"
      editLabel="Edit attribute"
      api={pimAttributesApi}
      idType="string"
    />
  );
}
