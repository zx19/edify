'use client'

import { createToast, createToastManager } from '@xsl/lomva-ui/toast'

const appConfigurationToastManager = createToastManager()
const toast = createToast(appConfigurationToastManager)

export { appConfigurationToastManager, toast }
