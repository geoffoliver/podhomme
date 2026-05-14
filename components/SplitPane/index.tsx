'use client'

import { LeftPane } from './LeftPane'
import { RightPane } from './RightPane'
import styles from './index.module.css'

export function SplitPane() {
  return (
    <div className={styles.splitPane}>
      <LeftPane />
      <RightPane />
    </div>
  )
}
