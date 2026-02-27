'use client'

import { FormPageContainer } from '@/components/admin/form-page-container'
import { useParams } from 'next/navigation'

export default function EditFormPage() {
  const params = useParams()
  const id = params?.id as string

  return <FormPageContainer formId={id} pageTitle="신청 폼 수정" pageTitleEn="Edit Form" />
}
