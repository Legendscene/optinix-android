/**
 * OptinixBannerAd.js — Safe, lifecycle-aware Banner Ad component.
 *
 * Rules:
 * 1. Automatically collapses and unmounts when an optimization operation starts.
 * 2. If an ad fails to load or no fill is returned, it collapses cleanly with no blank boxes.
 * 3. Never renders if ads are suppressed or disabled.
 */
import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads'
import adManager from '../../services/adManager'
import { useTheme } from '../../theme/ThemeProvider'

export function OptinixBannerAd({
  unitId,
  size = BannerAdSize.BANNER,
  style,
  testID = 'optinix-banner-ad',
}) {
  const theme = useTheme()
  const [canShow, setCanShow] = useState(() => adManager.canShowAds())
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Subscribe to AdManager events (e.g. optimization started/stopped)
    const unsubscribe = adManager.subscribe((state) => {
      setCanShow(state.canShowAds)
    })
    return unsubscribe
  }, [])

  // If optimization starts or ads are disabled, do not render
  if (!canShow || failed) {
    return null
  }

  const adUnitId = unitId || adManager.getBannerAdUnitId()

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          borderColor: theme.colors.border.base,
          backgroundColor: theme.colors.bg[1],
        },
        !loaded && styles.hidden,
        style,
      ]}
    >
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: !adManager.isConsentObtained,
        }}
        onAdLoaded={() => {
          setLoaded(true)
          setFailed(false)
        }}
        onAdFailedToLoad={() => {
          setFailed(true)
          setLoaded(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  hidden: {
    height: 0,
    marginVertical: 0,
    paddingVertical: 0,
    borderWidth: 0,
    opacity: 0,
  },
})

export default OptinixBannerAd
