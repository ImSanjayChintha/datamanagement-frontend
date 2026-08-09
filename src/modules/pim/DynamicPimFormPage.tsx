import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Spinner from '@/components/ui/Spinner';
import { QK } from '@/lib/queryKeys';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { makeEntityApi } from '@/modules/pim/api';
import PimFormPage from '@/modules/pim/components/PimFormPage';

export default function DynamicPimFormPage() {
  const { pageDefCode } = useParams<{ pageDefCode: string }>();
  const navigate = useNavigate();

  const { data: pageDef, isLoading, isError } = useQuery({
    queryKey: QK.pageDef(pageDefCode!),
    queryFn:  () => pageDefsApi.get(pageDefCode!),
    enabled:  !!pageDefCode,
    staleTime: 5 * 60_000,
  });

  const api = useMemo(
    () => pageDef ? makeEntityApi(pageDef.gateway_object, pageDef.table_code, {
      list:   pageDef.list_endpoint   || undefined,
      upsert: pageDef.upsert_endpoint || undefined,
      delete: pageDef.delete_endpoint || undefined,
    }) : null,
    [pageDef],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !pageDef || !api) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <p className="text-sm">Page "{pageDefCode}" not found.</p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">Go home</button>
      </div>
    );
  }

  return (
    <PimFormPage
      entityCode={pageDef.code}
      basePath={`/pim/${pageDef.code}`}
      newLabel={`New ${pageDef.title}`}
      editLabel={`Edit ${pageDef.title}`}
      api={api}
      idType={pageDef.id_type}
    />
  );
}
