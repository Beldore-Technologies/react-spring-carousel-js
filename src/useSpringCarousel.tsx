import {
  useRef,
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react'
import {
  useSpring,
  config,
  animated,
  AnimationResult,
} from 'react-spring'
import { useDrag } from '@use-gesture/react'
import {
  useCustomEventsModule,
  useFullscreenModule,
  useThumbsModule,
} from './modules'
import {
  UseSpringCarouselProps,
  UseSpringCarouselContextProps,
  SlideToItemFnProps,
  SlideActionType,
} from './types'
import { useMount } from './utils'
import { getIsBrowser } from './utils'
import classNames from 'classnames'

const UseSpringCarouselContext = createContext<
  UseSpringCarouselContextProps | undefined
>(undefined)

export function useSpringCarouselContext() {
  const context = useContext(UseSpringCarouselContext)

  if (!context) {
    throw new Error(`useSpringCarouselContext isn't being used within the useSringCarousel context; 
    use the context only inside a component that is rendered within the Carousel.`)
  }

  return context
}

export default function useSpringCarousel({
  items,
  withLoop = false,
  draggingSlideTreshold = 100,
  springConfig = config.default,
  shouldResizeOnWindowResize = true,
  withThumbs = false,
  enableThumbsWrapperScroll = true,
  carouselSlideAxis = 'x',
  thumbsSlideAxis = 'x',
  thumbsWrapperRef,
  prepareThumbsData,
  itemsPerSlide = 1,
  initialActiveItem = 0,
  initialStartingPosition = 'start',
  disableGestures = false,
  wrapperClass = '',
  itemClass = '',
  gutter = 0,
}: // gutter = 0,
// adjacentItemsPx = 0,
UseSpringCarouselProps) {
  const lastItemReached = useRef(false)
  function getItems() {
    if (withLoop) {
      return [...items, ...items, ...items]
    }
    return items
  }
  const slideActionType = useRef<SlideActionType>('next')
  const internalItems = getItems()
  const activeItem = useRef(initialActiveItem)
  const mainCarouselWrapperRef = useRef<HTMLDivElement | null>(null)
  const carouselTrackWrapperRef = useRef<HTMLDivElement | null>(null)
  const isDragging = useRef(false)
  const isAnimating = useRef(false)
  const windowIsHidden = useRef(false)
  const currentWindowWidth = useRef(0)

  function getCarouselItem() {
    if (carouselTrackWrapperRef.current) {
      return carouselTrackWrapperRef.current.querySelector(
        '.use-spring-carousel-item',
      )
    }
    return null
  }

  const [carouselStyles, setCarouselStyles] = useSpring(() => ({
    y: 0,
    x: 0,
    config: springConfig,
  }))
  const getSlideValue = useCallback(() => {
    if (!carouselTrackWrapperRef.current) {
      return 0
    }
    const carouselItem = getCarouselItem()

    if (!carouselItem) {
      throw Error('No carousel items available!')
    }

    if (carouselSlideAxis === 'x') {
      //return carouselItem.getBoundingClientRect().width + gutter
      return carouselItem.getBoundingClientRect().width
    }

    //return carouselItem.getBoundingClientRect().height + gutter
    return carouselItem.getBoundingClientRect().height
  }, [carouselSlideAxis])
  const adjustCarouselWrapperPosition = useCallback(
    (ref: HTMLDivElement) => {
      if (
        // itemsPerSlide !== 'fluid' &&
        typeof itemsPerSlide === 'number'
      ) {
        const positionProperty =
          carouselSlideAxis === 'x' ? 'left' : 'top'

        function getDefaultPositionValue() {
          return getSlideValue() * items.length
        }
        function setPosition(v: number) {
          ref.style.top = '0px'
          ref.style.left = '0px'
          ref.style[positionProperty] = `-${v}px`
        }
        function setStartPosition() {
          setPosition(getDefaultPositionValue())
        }
        function setCenterPosition() {
          setPosition(
            getDefaultPositionValue() -
              getSlideValue() *
                Math.round(((itemsPerSlide as number) - 1) / 2),
          )
        }
        function setEndPosition() {
          setPosition(
            getDefaultPositionValue() -
              getSlideValue() *
                Math.round((itemsPerSlide as number) - 1),
          )
        }

        if (itemsPerSlide > 1) {
          switch (initialStartingPosition) {
            default:
            case 'start': {
              setStartPosition()
              break
            }
            case 'center': {
              setCenterPosition()
              break
            }
            case 'end': {
              setEndPosition()
              break
            }
          }
        } else {
          setStartPosition()
        }
      }
    },
    [
      carouselSlideAxis,
      getSlideValue,
      initialStartingPosition,
      items.length,
      itemsPerSlide,
    ],
  )
  const handleResize = useCallback(() => {
    if (window.innerWidth === currentWindowWidth.current) {
      return
    }
    currentWindowWidth.current = window.innerWidth

    setCarouselStyles.start({
      immediate: true,
      x: 0,
      y: 0,
    })
    setCarouselStyles.start({
      immediate: true,
      [carouselSlideAxis]: -(
        getSlideValue() * getCurrentActiveItem()
      ),
    })

    if (withLoop) {
      adjustCarouselWrapperPosition(carouselTrackWrapperRef.current!)
    }
  }, [
    adjustCarouselWrapperPosition,
    carouselSlideAxis,
    getSlideValue,
    setCarouselStyles,
    withLoop,
  ])

  // Custom modules
  const {
    useListenToCustomEvent,
    emitObservable,
  } = useCustomEventsModule()
  const {
    enterFullscreen,
    exitFullscreen,
    getIsFullscreen,
  } = useFullscreenModule({
    mainCarouselWrapperRef,
    emitObservable,
    handleResize,
  })
  const {
    thumbsFragment: _thumbsFragment,
    handleThumbsScroll,
  } = useThumbsModule({
    withThumbs,
    items,
    thumbsSlideAxis,
    springConfig,
    thumbsWrapperRef,
    prepareThumbsData,
  })
  const bindDrag = useDrag(
    props => {
      const isDragging = props.dragging
      const movement =
        props.movement[carouselSlideAxis === 'x' ? 0 : 1]

      const currentSlidedValue = -(
        getSlideValue() * getCurrentActiveItem()
      )

      function resetAnimation() {
        setCarouselStyles.start({
          [carouselSlideAxis]: currentSlidedValue,
        })
      }

      if (isDragging) {
        setCarouselStyles.start({
          [carouselSlideAxis]: currentSlidedValue + movement,
        })
        setIsDragging(true)
        emitObservable({
          eventName: 'onDrag',
          ...props,
        })

        const prevItemTreshold = movement > draggingSlideTreshold
        const nextItemTreshold = movement < -draggingSlideTreshold

        if (nextItemTreshold) {
          if (!withLoop && getIsLastItem()) {
            resetAnimation()
          } else {
            slideToNextItem()
          }
          props.cancel()
        } else if (prevItemTreshold) {
          if (!withLoop && getIsFirstItem()) {
            resetAnimation()
          } else {
            slideToPrevItem()
          }
          props.cancel()
        }
      }

      if (props.last) {
        resetAnimation()
      }
    },
    {
      enabled: !disableGestures,
    },
  )
  // Perform some check on first mount
  useMount(() => {
    if (
      // itemsPerSlide !== 'fluid' &&
      !Number.isInteger(itemsPerSlide)
    ) {
      throw new Error(`itemsPerSlide should be an integer.`)
    }

    if (itemsPerSlide > items.length) {
      throw new Error(
        `The itemsPerSlide prop can't be greater than the total length of the items you provide.`,
      )
    }

    if (itemsPerSlide < 1) {
      throw new Error(`The itemsPerSlide prop can't be less than 1.`)
    }

    if (!shouldResizeOnWindowResize) {
      console.warn(
        'You set shouldResizeOnWindowResize={false}; be aware that the carousel could behave in a strange way if you also use the fullscreen functionality or if you change the mobile orientation.',
      )
    }

    if (initialActiveItem < 0) {
      console.warn('The initialActiveItem cannot be less than 0.')
    }

    if (initialActiveItem > items.length) {
      console.warn(
        'The initialActiveItem cannot be greater than the total length of the items you provide.',
      )
    }
  })
  useMount(() => {
    currentWindowWidth.current = window.innerWidth
    function handleVisibilityChange() {
      if (document.hidden) {
        windowIsHidden.current = true
      } else {
        windowIsHidden.current = false
      }
    }

    if (getIsBrowser()) {
      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      return () => {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        )
      }
    }
  })
  useEffect(() => {
    if (shouldResizeOnWindowResize) {
      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [handleResize, shouldResizeOnWindowResize])
  useEffect(() => {
    if (carouselTrackWrapperRef.current) {
      if (carouselSlideAxis === 'x') {
        carouselTrackWrapperRef.current.style.top = '0px'
      }
      if (carouselSlideAxis === 'y') {
        carouselTrackWrapperRef.current.style.left = '0px'
      }
    }
  }, [carouselSlideAxis])
  useMount(() => {
    if (initialActiveItem > 0 && initialActiveItem <= items.length) {
      slideToItem({
        to: initialActiveItem,
        immediate: true,
      })
      setActiveItem(initialActiveItem)
    }
  })
  useEffect(() => {
    if (
      // itemsPerSlide === 'fluid' &&
      carouselTrackWrapperRef.current
    ) {
      const items = carouselTrackWrapperRef.current.querySelectorAll(
        '.use-spring-carousel-item',
      )
      const lastItem = items[items.length - 1]
      const observer = new IntersectionObserver(
        entries => {
          const lastItemEntry = entries[0]
          if (lastItemEntry.isIntersecting) {
            lastItemReached.current = true
          } else {
            lastItemReached.current = false
          }
        },
        {
          threshold: 1,
        },
      )
      observer.observe(lastItem)

      return () => {
        observer.unobserve(lastItem)
      }
    }
  }, [itemsPerSlide])

  function setSlideActionType(type: SlideActionType) {
    slideActionType.current = type
  }
  function getSlideActionType() {
    return slideActionType.current
  }
  function setActiveItem(newItem: number) {
    activeItem.current = newItem
  }
  function getCurrentActiveItem() {
    return activeItem.current
  }
  function getIsAnimating() {
    return isAnimating.current
  }
  function setIsAnimating(val: boolean) {
    isAnimating.current = val
  }
  function setIsDragging(val: boolean) {
    isDragging.current = val
  }
  function getIsDragging() {
    return isDragging.current
  }
  function getPrevItem() {
    const currentActiveItem = getCurrentActiveItem()
    if (currentActiveItem === 0) {
      return items.length - 1
    }
    return currentActiveItem - 1
  }
  function getNextItem() {
    const currentActiveItem = getCurrentActiveItem()
    if (currentActiveItem === items.length - 1) {
      return 0
    }
    return currentActiveItem + 1
  }
  function getIsNextItem(id: string) {
    const itemIndex = findItemIndex(id)
    const activeItem = getCurrentActiveItem()
    if (withLoop && activeItem === items.length - 1) {
      return itemIndex === 0
    }
    return itemIndex === activeItem + 1
  }
  function getIsPrevItem(id: string) {
    const itemIndex = findItemIndex(id)
    const activeItem = getCurrentActiveItem()
    if (withLoop && activeItem === 0) {
      return itemIndex === items.length - 1
    }
    return itemIndex === activeItem - 1
  }
  function findItemIndex(id: string) {
    return items.findIndex(item => item.id === id)
  }
  function slideToItem({
    from,
    to,
    immediate = false,
    onRest = () => {},
  }: SlideToItemFnProps) {
    if (!immediate) {
      setActiveItem(to)
      setIsAnimating(true)
      emitObservable({
        eventName: 'onSlideStartChange',
        nextItem: to,
        slideActionType: getSlideActionType(),
      })
    }

    function getFromValue() {
      if (from) {
        return {
          from: {
            [carouselSlideAxis]: from,
          },
        }
      }
      return {}
    }

    setCarouselStyles.start({
      ...getFromValue(),
      to: {
        [carouselSlideAxis]: -(getSlideValue() * to),
      },
      immediate,
      onRest: (val: AnimationResult) => {
        if (val.finished) {
          setIsDragging(false)
          setIsAnimating(false)
          onRest()

          if (!immediate) {
            emitObservable({
              eventName: 'onSlideChange',
              currentItem: getCurrentActiveItem(),
              slideActionType: getSlideActionType(),
            })
          }
        }
      },
    })

    if (enableThumbsWrapperScroll && withThumbs && !immediate) {
      handleThumbsScroll(to)
    }
  }
  function getWrapperFromValue(element: HTMLDivElement) {
    if (element.style.transform === 'none') {
      return 0
    }

    const values = element.style.transform.split(/\w+\(|\);?/)
    return Number(
      values[1]
        .split(/,\s?/g)
        [carouselSlideAxis === 'x' ? 0 : 1].replace('px', ''),
    )
  }
  function getIsFirstItem() {
    return getCurrentActiveItem() === 0
  }
  function getIsLastItem() {
    return getCurrentActiveItem() === items.length - 1
  }
  function slideToPrevItem() {
    if (
      (!withLoop && getCurrentActiveItem() === 0) ||
      windowIsHidden.current
    ) {
      return
    }

    setSlideActionType('prev')
    if (getIsFirstItem()) {
      slideToItem({
        from: -(
          Math.abs(
            getWrapperFromValue(carouselTrackWrapperRef.current!),
          ) +
          getSlideValue() * items.length
        ),
        to: items.length - 1,
      })
    } else {
      slideToItem({
        to: getPrevItem(),
      })
    }
  }
  function slideToNextItem() {
    if (
      (!withLoop &&
        getCurrentActiveItem() === internalItems.length - 1) ||
      windowIsHidden.current ||
      lastItemReached.current
    ) {
      return
    }

    setSlideActionType('next')
    if (getIsLastItem()) {
      slideToItem({
        from:
          getWrapperFromValue(carouselTrackWrapperRef.current!) +
          getSlideValue() * items.length,
        to: 0,
      })
    } else {
      slideToItem({
        to: getNextItem(),
      })
    }
  }
  function _slideToItem(item: string | number) {
    let itemIndex = 0

    if (typeof item === 'string') {
      itemIndex = items.findIndex(_item => _item.id === item)
    } else {
      itemIndex = item
    }

    if (itemIndex >= items.length) {
      throw Error(
        `The item you want to slide to doesn't exist. This could be due to the fact that 
        you provide a wrong id or a higher numeric index.`,
      )
    }

    if (itemIndex === getCurrentActiveItem()) {
      return
    }

    const currentItem = findItemIndex(
      items[getCurrentActiveItem()].id,
    )
    const newActiveItem = findItemIndex(items[itemIndex].id)

    if (newActiveItem > currentItem) {
      setSlideActionType('next')
    } else {
      setSlideActionType('prev')
    }

    slideToItem({
      to: itemIndex,
    })
  }
  const contextProps: UseSpringCarouselContextProps = {
    useListenToCustomEvent,
    getIsFullscreen,
    enterFullscreen,
    exitFullscreen,
    getIsAnimating,
    getIsDragging,
    getIsNextItem,
    getIsPrevItem,
    slideToPrevItem,
    slideToNextItem,
    slideToItem: _slideToItem,
    getIsActiveItem: id => {
      return findItemIndex(id) === getCurrentActiveItem()
    },
    getCurrentActiveItem: () => ({
      id: items[getCurrentActiveItem()].id,
      index: getCurrentActiveItem(),
    }),
  }

  const carouselFragment = (
    <UseSpringCarouselContext.Provider value={contextProps}>
      <div
        ref={mainCarouselWrapperRef}
        data-testid="use-spring-carousel-wrapper"
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <animated.div
          {...bindDrag()}
          className={wrapperClass}
          data-testid="use-spring-carousel-animated-wrapper"
          style={{
            display: 'grid',
            flexDirection:
              carouselSlideAxis === 'x' ? 'row' : 'column',
            gap: gutter,
            gridTemplateColumns:
              carouselSlideAxis === 'x'
                ? `repeat(${internalItems.length}, calc((100% - ${
                    (itemsPerSlide - 1) * gutter
                  }px) / ${itemsPerSlide}))`
                : 'auto',
            top: 0,
            left: 0,
            position: 'relative',
            width: '100%',
            ...carouselStyles,
            touchAction: 'none',
          }}
          ref={ref => {
            if (ref) {
              carouselTrackWrapperRef.current = ref
              if (withLoop) {
                adjustCarouselWrapperPosition(ref)
              }
            }
          }}
        >
          {internalItems.map(({ id, renderItem }, index) => {
            return (
              <div
                key={`${id}-${index}`}
                className={classNames(
                  'use-spring-carousel-item',
                  itemClass,
                )}
                data-testid="use-spring-carousel-item-wrapper"
                style={{
                  display: 'flex',
                  position: 'relative',
                  flex: `1 0 calc(100% / ${itemsPerSlide})`,
                }}
              >
                {renderItem}
              </div>
            )
          })}
        </animated.div>
      </div>
    </UseSpringCarouselContext.Provider>
  )
  const thumbsFragment = (
    <UseSpringCarouselContext.Provider value={contextProps}>
      {_thumbsFragment}
    </UseSpringCarouselContext.Provider>
  )

  return {
    carouselFragment,
    thumbsFragment,
    ...contextProps,
  }
}
