import type { ChangeEvent, FC, FormEvent } from 'react'
import type { InputValueTypes } from '../types'
import type { FileEntity } from '@/app/components/base/file-uploader/types'
import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { VisionFile, VisionSettings } from '@/types/app'
import { Button } from '@xsl/lomva-ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@xsl/lomva-ui/select'
import { Textarea } from '@xsl/lomva-ui/textarea'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUploaderInAttachmentWrapper } from '@/app/components/base/file-uploader'
import TextGenerationImageUploader from '@/app/components/base/image-uploader/text-generation-image-uploader'
import Input from '@/app/components/base/input'
import BoolInput from '@/app/components/workflow/nodes/_base/components/before-run-form/bool-input'
import CodeEditor from '@/app/components/workflow/nodes/_base/components/editor/code-editor'
import { CodeLanguage } from '@/app/components/workflow/nodes/code/types'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'

type IRunOnceProps = {
  siteInfo: SiteInfo
  promptConfig: PromptConfig
  inputs: Record<string, InputValueTypes>
  inputsRef: React.RefObject<Record<string, InputValueTypes>>
  onInputsChange: (inputs: Record<string, InputValueTypes>) => void
  onSend: () => void
  visionConfig: VisionSettings
  onVisionFilesChange: (files: VisionFile[]) => void
  runControl?: {
    onStop: () => Promise<void> | void
    isStopping: boolean
  } | null
}

/**
 * 运行一次表单（completion/workflow 单元重写 2026-09-22，mockup 类型3）：
 * 呈现层新写消费 token 变量（家族根自挂 .webapp-theme）；字段件复用共享件（Input/Textarea/Select 等）；
 * 行为（初始化默认值/清空/提交/停止）与原实现逐字一致。
 */
const RunOnce: FC<IRunOnceProps> = ({
  promptConfig,
  inputs,
  inputsRef,
  onInputsChange,
  onSend,
  visionConfig,
  onVisionFilesChange,
  runControl,
}) => {
  const { t } = useTranslation()
  const media = useBreakpoints()
  const isPC = media === MediaType.pc
  const [isInitialized, setIsInitialized] = useState(false)

  const onClear = () => {
    const newInputs: Record<string, InputValueTypes> = {}
    promptConfig.prompt_variables.forEach((item) => {
      if (item.type === 'string' || item.type === 'paragraph') newInputs[item.key] = ''
      else if (item.type === 'number') newInputs[item.key] = ''
      else if (item.type === 'checkbox') newInputs[item.key] = false
      else newInputs[item.key] = undefined
    })
    onInputsChange(newInputs)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSend()
  }
  const isRunning = !!runControl
  const stopLabel = t(($) => $['generation.stopRun'], { ns: 'share', defaultValue: 'Stop Run' })
  const handlePrimaryClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isRunning) return
      e.preventDefault()
      runControl?.onStop?.()
    },
    [isRunning, runControl],
  )

  const handleInputsChange = useCallback(
    (newInputs: Record<string, any>) => {
      onInputsChange(newInputs)
      inputsRef.current = newInputs
    },
    [onInputsChange, inputsRef],
  )

  useEffect(() => {
    if (isInitialized) return
    const newInputs: Record<string, any> = {}
    promptConfig.prompt_variables.forEach((item) => {
      if (item.type === 'select') newInputs[item.key] = item.default
      else if (item.type === 'string' || item.type === 'paragraph')
        newInputs[item.key] = item.default || ''
      else if (item.type === 'number') newInputs[item.key] = item.default ?? ''
      else if (item.type === 'checkbox') newInputs[item.key] = item.default || false
      else if (item.type === 'file') newInputs[item.key] = undefined
      else if (item.type === 'file-list') newInputs[item.key] = []
      else newInputs[item.key] = undefined
    })
    onInputsChange(newInputs)
    setIsInitialized(true)
  }, [promptConfig.prompt_variables, onInputsChange])

  const showForm =
    inputs !== null && inputs !== undefined && Object.keys(inputs).length > 0 && isInitialized

  return (
    <div>
      <section>
        <form onSubmit={onSubmit}>
          {showForm &&
            promptConfig.prompt_variables
              .filter((item) => item.hide !== true)
              .map((item) => {
                const inputValue = inputs[item.key]
                const selectValue =
                  typeof inputValue === 'string' && inputValue !== '' ? inputValue : null
                const defaultSelectValue =
                  typeof item.default === 'string' && item.default !== '' ? item.default : null

                return (
                  <div className="mt-4 w-full" key={item.key}>
                    {item.type !== 'checkbox' && (
                      <div className="flex h-6 items-center gap-1 text-[12px] font-semibold text-[var(--text-2)]">
                        <div className="truncate">{item.name}</div>
                        {item.required ? (
                          <span aria-hidden className="text-[var(--danger)]">
                            *
                          </span>
                        ) : (
                          <span className="text-[11px] font-normal text-[var(--text-3)]">
                            {t(($) => $['panel.optional'], { ns: 'workflow' })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1">
                      {item.type === 'select' && (
                        <Select<string>
                          value={selectValue ?? defaultSelectValue}
                          onValueChange={(nextValue) => {
                            if (nextValue == null || nextValue === '') return
                            handleInputsChange({ ...inputsRef.current, [item.key]: nextValue })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(($) => $['placeholder.select'], { ns: 'common' })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(item.options || []).map((option) => (
                              <SelectItem key={option} value={option}>
                                <SelectItemText>{option}</SelectItemText>
                                <SelectItemIndicator />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {item.type === 'string' && (
                        <Input
                          type="text"
                          placeholder={item.name}
                          value={inputs[item.key] as string}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            handleInputsChange({
                              ...inputsRef.current,
                              [item.key]: e.target.value,
                            })
                          }}
                          maxLength={item.max_length || undefined}
                        />
                      )}
                      {item.type === 'paragraph' && (
                        <Textarea
                          aria-label={item.name}
                          className="h-26 sm:text-xs"
                          placeholder={item.name}
                          value={inputs[item.key] as string}
                          onValueChange={(value) => {
                            handleInputsChange({ ...inputsRef.current, [item.key]: value })
                          }}
                        />
                      )}
                      {item.type === 'number' && (
                        <Input
                          type="number"
                          placeholder={item.name}
                          value={inputs[item.key] as number}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            handleInputsChange({
                              ...inputsRef.current,
                              [item.key]: e.target.value,
                            })
                          }}
                        />
                      )}
                      {item.type === 'checkbox' && (
                        <BoolInput
                          name={item.name || item.key}
                          value={!!inputs[item.key] as boolean}
                          required={item.required}
                          onChange={(value) => {
                            handleInputsChange({ ...inputsRef.current, [item.key]: value })
                          }}
                        />
                      )}
                      {item.type === 'file' && (
                        <FileUploaderInAttachmentWrapper
                          value={
                            inputs[item.key] &&
                            typeof inputs[item.key] === 'object' &&
                            !Array.isArray(inputs[item.key])
                              ? [inputs[item.key] as FileEntity]
                              : []
                          }
                          onChange={(files) => {
                            handleInputsChange({ ...inputsRef.current, [item.key]: files[0] })
                          }}
                          fileConfig={{
                            ...item.config,
                            fileUploadConfig: (visionConfig as any).fileUploadConfig,
                          }}
                        />
                      )}
                      {item.type === 'file-list' && (
                        <FileUploaderInAttachmentWrapper
                          value={
                            Array.isArray(inputs[item.key])
                              ? (inputs[item.key] as FileEntity[])
                              : []
                          }
                          onChange={(files) => {
                            handleInputsChange({ ...inputsRef.current, [item.key]: files })
                          }}
                          fileConfig={{
                            ...item.config,
                            // oxlint-disable-next-line typescript/no-explicit-any
                            fileUploadConfig: (visionConfig as any).fileUploadConfig,
                          }}
                        />
                      )}
                      {item.type === 'json_object' && (
                        <CodeEditor
                          language={CodeLanguage.json}
                          value={inputs[item.key] as string}
                          onChange={(value) => {
                            handleInputsChange({ ...inputsRef.current, [item.key]: value })
                          }}
                          noWrapper
                          className="h-20 overflow-y-auto rounded-[10px] bg-[var(--bg-soft)] p-1"
                          placeholder={
                            <div className="whitespace-pre">
                              {typeof item.json_schema === 'string'
                                ? item.json_schema
                                : JSON.stringify(item.json_schema || '', null, 2)}
                            </div>
                          }
                        />
                      )}
                    </div>
                  </div>
                )
              })}
          {visionConfig?.enabled && (
            <div className="mt-4 w-full">
              <div className="flex h-6 items-center text-[12px] font-semibold text-[var(--text-2)]">
                {t(($) => $['imageUploader.imageUpload'], { ns: 'common' })}
              </div>
              <div className="mt-1">
                <TextGenerationImageUploader
                  settings={visionConfig}
                  onFilesChange={(files) =>
                    onVisionFilesChange(
                      files
                        .filter((file) => file.progress !== -1)
                        .map((fileItem) => ({
                          type: 'image',
                          transfer_method: fileItem.type,
                          url: fileItem.url,
                          upload_file_id: fileItem.fileId,
                        })),
                    )
                  }
                />
              </div>
            </div>
          )}
          {/* 操作条：桌面 sticky 沉底（表单列独立滚动内）；<900px/移动静态（mockup 移动帧 position:static） */}
          <div className="mt-6 mb-3 flex items-center justify-between gap-2 @[900px]:sticky @[900px]:bottom-0 @[900px]:mb-0 @[900px]:bg-[var(--bg)] @[900px]:py-2.5">
            <Button onClick={onClear} disabled={false}>
              <span className="text-[13px]">
                {t(($) => $['operation.clear'], { ns: 'common' })}
              </span>
            </Button>
            <Button
              className={!isPC ? 'grow' : ''}
              type={isRunning ? 'button' : 'submit'}
              variant={isRunning ? 'secondary' : 'primary'}
              disabled={isRunning && runControl?.isStopping}
              onClick={handlePrimaryClick}
            >
              {isRunning ? (
                <>
                  {runControl?.isStopping ? (
                    <span aria-hidden className="i-ri-loader-2-line size-4 shrink-0 animate-spin" />
                  ) : (
                    <span aria-hidden className="i-ri-stop-circle-fill size-4 shrink-0" />
                  )}
                  <span className="text-[13px]">{stopLabel}</span>
                </>
              ) : (
                <>
                  <span aria-hidden className="i-ri-play-large-line size-4 shrink-0" />
                  <span className="text-[13px]">
                    {t(($) => $['generation.run'], { ns: 'share' })}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
export default React.memo(RunOnce)
