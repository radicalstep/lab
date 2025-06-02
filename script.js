document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const filterList = document.getElementById('filter-list');
    const rightPaneHeaderTitle = document.getElementById('right-pane-header-title');
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const detailViewContainer = document.getElementById('detail-view-container');
    const detailModalImage = document.getElementById('detail-modal-image');
    const detailSbsAnimeImage = document.getElementById('detail-sbs-anime-image');
    const detailSbsRealImage = document.getElementById('detail-sbs-real-image');
    const detailToggleComparisonButton = document.getElementById('detail-toggle-comparison-button');
    const detailTitle = document.getElementById('detail-title');
    const detailAnimeTitleDisplay = document.getElementById('detail-anime-title-display');
    const detailPhotoDescription = document.getElementById('detail-photo-description');
    const detailDatetimeOriginal = document.getElementById('detail-datetime-original');
    const detailMapElement = document.getElementById('detail-map-element');
    const detailStreetviewLink = document.getElementById('detail-streetview-link');
    const detailSingleImageView = document.getElementById('detail-single-image-view');
    const detailSideBySideView = document.getElementById('detail-side-by-side-view');
    const detailThumbnailList = document.getElementById('detail-thumbnail-list');
    
    const toggleMainViewButton = document.getElementById('toggle-main-view-button');
    const returnToGalleryButton = document.getElementById('return-to-gallery-button');
    const returnToMapButton = document.getElementById('return-to-map-button');

    const mapViewContainer = document.getElementById('map-view-container');
    const mainMapElement = document.getElementById('main-map-element');

    // State Variables
    let allPhotosData = [];
    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true;
    let isDetailSideBySideActive = false;
    let detailMap = null;
    let currentMapMarker = null;
    let currentFilteredPhotosForGallery = [];
    let currentPhotoIndexInDetail = -1;
    let currentView = 'gallery';
    let previousViewBeforeDetail = 'gallery'; 
    let mainMap = null;
    let mainMapMarkers = [];
    let currentFilteredPhotosForMap = [];
    let lastDetailPhotoLocation = null;

    async function loadPhotoData() {
        try {
            const response = await fetch('photos.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawPhotos = await response.json();
            allPhotosData = await processAllPhotosExif(rawPhotos);
            
            populateFilters();
            showGalleryView(); 
        } catch (error) {
            console.error("写真データの読み込みまたはEXIF処理に失敗しました:", error);
            photoGalleryContainer.innerHTML = '<p style="color: red; text-align: center;">写真データの読み込みに失敗しました。photos.jsonまたは画像ファイルを確認してください。</p>';
        }
    }

    async function processAllPhotosExif(photos) {
        const photosWithExifPromises = photos.map(async (photo) => {
            const exif = await fetchExifDataWithExifJS(photo.realSrc);
            return { ...photo, exif };
        });
        return Promise.all(photosWithExifPromises);
    }

    function populateFilters() {
        filterList.innerHTML = '';
        const allFilterItem = document.createElement('li');
        allFilterItem.classList.add('filter-item', 'active');
        allFilterItem.dataset.filter = 'all';
        allFilterItem.textContent = 'すべて';
        filterList.appendChild(allFilterItem);

        const animeFilters = [];
        allPhotosData.forEach(photo => {
            if (!animeFilters.some(f => f.tag === photo.animeFilterTag)) {
                animeFilters.push({ tag: photo.animeFilterTag, display: photo.animeTitleDisplay });
            }
        });
        animeFilters.sort((a, b) => a.display.localeCompare(b.display, 'ja'));
        animeFilters.forEach(filter => {
            const filterItem = document.createElement('li');
            filterItem.classList.add('filter-item');
            filterItem.dataset.filter = filter.tag;
            filterItem.textContent = filter.display;
            filterList.appendChild(filterItem);
        });
    }
    
    function showGalleryView() {
        currentView = 'gallery';
        photoGalleryContainer.classList.add('active-content');
        mapViewContainer.classList.remove('active-content');
        detailViewContainer.classList.remove('active-content');

        rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
        
        toggleMainViewButton.textContent = 'マップで表示';
        toggleMainViewButton.style.display = 'inline-block';
        returnToGalleryButton.style.display = 'none';
        returnToMapButton.style.display = 'none';

        const activeFilter = document.querySelector('#filter-list .filter-item.active');
        const filterType = activeFilter ? activeFilter.dataset.filter : 'all';
        filterAndDisplayPhotosInGallery(filterType);
        // previousViewBeforeDetail は exitDetailViewAndSwitch で設定されるか、
        // openDetailView の冒頭で、detail 以外のビューから来た場合に設定される。
        // ここでは、このビューがアクティブになったことを示す。
    }

    function showMapView() {
        currentView = 'map';
        photoGalleryContainer.classList.remove('active-content');
        mapViewContainer.classList.add('active-content');
        detailViewContainer.classList.remove('active-content');

        rightPaneHeaderTitle.textContent = '聖地マップ';

        toggleMainViewButton.textContent = 'ギャラリーで表示';
        toggleMainViewButton.style.display = 'inline-block';
        returnToGalleryButton.style.display = 'none';
        returnToMapButton.style.display = 'none';

        initializeMainMapAndPlotMarkers();

        if (previousViewBeforeDetail === 'detail' && lastDetailPhotoLocation && mainMap) {
            mainMap.setView(lastDetailPhotoLocation, 15); // ズームレベル15で中心を移動
            // lastDetailPhotoLocation は一度使ったらクリアしても良いが、再度マップに戻る場合を考慮して残すこともできる。
            // ここでは、詳細ビューを開くたびに上書きされるので、クリアは必須ではない。
        }
        // previousViewBeforeDetail の更新は exitDetailViewAndSwitch や openDetailView で行う
    }

    function initializeMainMapAndPlotMarkers() {
        if (!mainMap) {
            mainMapElement.innerHTML = ''; 
            mainMap = L.map(mainMapElement).setView([36, 138], 5); 
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(mainMap);
        }
        
        const activeFilterItem = document.querySelector('#filter-list .filter-item.active');
        const filterType = activeFilterItem ? activeFilterItem.dataset.filter : 'all';
        currentFilteredPhotosForMap = (filterType === 'all')
            ? allPhotosData.filter(photo => photo.exif && photo.exif.latitude && photo.exif.longitude)
            : allPhotosData.filter(photo => photo.animeFilterTag === filterType && photo.exif && photo.exif.latitude && photo.exif.longitude);

        plotMarkersOnMainMap(currentFilteredPhotosForMap);
        
        requestAnimationFrame(() => {
            if (mainMap) mainMap.invalidateSize();
        });
    }
    
    function plotMarkersOnMainMap(photosToPlot) {
        mainMapMarkers.forEach(marker => marker.remove());
        mainMapMarkers = [];
        const markerCoordinates = [];

        const existingMessage = mainMapElement.querySelector('.map-message-overlay');
        if (existingMessage) existingMessage.remove();

        if (photosToPlot.length === 0) {
            const messageOverlay = document.createElement('div');
            messageOverlay.className = 'map-message-overlay';
            messageOverlay.style.position = 'absolute';
            messageOverlay.style.top = '50%';
            messageOverlay.style.left = '50%';
            messageOverlay.style.transform = 'translate(-50%, -50%)';
            messageOverlay.style.padding = '20px';
            messageOverlay.style.backgroundColor = 'rgba(255,255,255,0.8)';
            messageOverlay.style.color = '#777';
            messageOverlay.style.textAlign = 'center';
            messageOverlay.style.zIndex = '1000';
            messageOverlay.textContent = '表示できる位置情報付きの写真がありません。';
            mainMapElement.appendChild(messageOverlay);

            if(mainMap) mainMap.setView([36, 138], 5);
            return;
        }
        
        photosToPlot.forEach(photo => {
            const marker = L.marker([photo.exif.latitude, photo.exif.longitude]);
            const popupContent = `
                <div>
                    <img src="${photo.realSrc}" alt="${photo.title}" class="popup-thumbnail">
                    <strong>${photo.title}</strong><br>
                    アニメ: ${photo.animeTitleDisplay}<br>
                    <a href="#" class="map-popup-detail-link" data-photo-id="${photo.id}">詳細を見る</a>
                </div>`;
            marker.bindPopup(popupContent);
            
            marker.on('popupopen', (e) => {
                const popupNode = e.popup.getElement();
                if (popupNode) {
                    const detailLink = popupNode.querySelector('.map-popup-detail-link');
                    if (detailLink) {
                        const newDetailLink = detailLink.cloneNode(true);
                        detailLink.parentNode.replaceChild(newDetailLink, detailLink);
                        newDetailLink.addEventListener('click', (event) => {
                            event.preventDefault();
                            const photoId = parseInt(event.target.dataset.photoId);
                            openDetailView(photoId);
                            if (mainMap) mainMap.closePopup();
                        });
                    }
                }
            });

            mainMapMarkers.push(marker);
            markerCoordinates.push([photo.exif.latitude, photo.exif.longitude]);
        });

        // マーカーをマップに追加
        if (mainMapMarkers.length > 0) {
            L.featureGroup(mainMapMarkers).addTo(mainMap);
        }

        // 詳細から戻ってきた場合は、showMapView内でsetViewするので、ここではfitBoundsしない。
        // それ以外の通常のマップ表示やフィルター変更時はfitBoundsを行う。
        if (!(previousViewBeforeDetail === 'detail' && lastDetailPhotoLocation)) {
            if (mainMapMarkers.length > 0) {
                if (markerCoordinates.length > 1) {
                    mainMap.fitBounds(L.latLngBounds(markerCoordinates).pad(0.2));
                } else if (markerCoordinates.length === 1) {
                    mainMap.setView(markerCoordinates[0], 12); 
                }
            } else { 
                if(mainMap) mainMap.setView([36, 138], 5); 
            }
        }
        // previousViewBeforeDetail === 'detail' の場合は、マーカーはプロット済みで、
        // 中心位置は showMapView の中で lastDetailPhotoLocation を使って設定される。
    }

    function filterAndDisplayPhotosInGallery(filterType) {
        currentFilteredPhotosForGallery = (filterType === 'all' || !filterType) 
            ? [...allPhotosData] 
            : allPhotosData.filter(photo => photo.animeFilterTag === filterType);
        displayPhotosInGallery(currentFilteredPhotosForGallery);
    }

    function displayPhotosInGallery(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;
            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `<span class="title">${photo.title}</span><span class="anime-title">${photo.animeTitleDisplay}</span>`;
            tile.appendChild(img);
            tile.appendChild(infoDiv);
            photoGalleryContainer.appendChild(tile);
            tile.addEventListener('click', () => openDetailView(photo.id));
        });
    }

    async function fetchExifDataWithExifJS(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
                EXIF.getData(img, function() {
                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lon = EXIF.getTag(this, "GPSLongitude");
                    const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                    const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
                    let dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");
                    let exifInfo = { latitude: null, longitude: null, dateTimeOriginal: null, error: null };

                    if (lat && lon && latRef && lonRef && lat.length === 3 && lon.length === 3) {
                        exifInfo.latitude = convertDMSToDD(lat[0].valueOf(), lat[1].valueOf(), lat[2].valueOf(), latRef);
                        exifInfo.longitude = convertDMSToDD(lon[0].valueOf(), lon[1].valueOf(), lon[2].valueOf(), lonRef);
                    } else {
                        if (!exifInfo.error) exifInfo.error = "位置情報なし";
                    }

                    if (dateTimeOriginal) {
                        const parts = dateTimeOriginal.split(" ");
                        if (parts.length === 2) {
                            const dateParts = parts[0].split(":");
                            if (dateParts.length === 3) {
                                exifInfo.dateTimeOriginal = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T${parts[1]}`;
                            } else {
                                if (!exifInfo.error) exifInfo.error = (exifInfo.error ? exifInfo.error + "、" : "") + "日時形式不正";
                            }
                        } else {
                             if (!exifInfo.error) exifInfo.error = (exifInfo.error ? exifInfo.error + "、" : "") + "日時形式不正";
                        }
                    } else {
                        if (!exifInfo.latitude && !exifInfo.longitude) {
                             exifInfo.error = "位置・日時情報なし";
                        } else if (!exifInfo.error) {
                             exifInfo.error = (exifInfo.error ? exifInfo.error + "、" : "") + "日時情報なし";
                        }
                    }
                    resolve(exifInfo);
                });
            };
            img.onerror = function() {
                resolve({ latitude: null, longitude: null, dateTimeOriginal: null, error: "画像読み込み失敗、EXIF取得不可" });
            }
            img.src = imageSrc;
        });
    }

    function convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction == "S" || direction == "W") { dd = dd * -1; }
        return dd;
    }

    async function openDetailView(photoId) {
        const newPhotoId = parseInt(photoId);
        currentPhotoData = allPhotosData.find(p => p.id === newPhotoId);
        
        if (!currentPhotoData) {
            console.error("openDetailView: 指定された photoId のデータが見つかりません:", newPhotoId);
            return;
        }

        if (currentPhotoData.exif && currentPhotoData.exif.latitude && currentPhotoData.exif.longitude) {
            lastDetailPhotoLocation = [currentPhotoData.exif.latitude, currentPhotoData.exif.longitude];
        } else {
            lastDetailPhotoLocation = null;
        }

        if (currentView !== 'detail') { // detailビューに遷移する直前のビューを記録
            previousViewBeforeDetail = currentView; 
        }
        currentView = 'detail'; // 現在のビューを 'detail' に更新
        
        let photosForDetailContext;
        // previousViewBeforeDetail は 'gallery' または 'map' のはず
        if (previousViewBeforeDetail === 'map') { 
            photosForDetailContext = [...currentFilteredPhotosForMap];
        } else { 
            photosForDetailContext = [...currentFilteredPhotosForGallery];
        }
        currentPhotoIndexInDetail = photosForDetailContext.findIndex(p => p.id === newPhotoId);

        photoGalleryContainer.classList.remove('active-content');
        mapViewContainer.classList.remove('active-content');
        detailViewContainer.classList.add('active-content');
        
        rightPaneHeaderTitle.textContent = currentPhotoData.title;

        toggleMainViewButton.style.display = 'none'; 
        returnToGalleryButton.style.display = 'inline-block';
        returnToMapButton.style.display = 'inline-block';
        
        isRealImageDisplayedInSingleView = true; 
        detailModalImage.src = currentPhotoData.realSrc;
        detailSbsAnimeImage.src = currentPhotoData.animeSrc;
        detailSbsRealImage.src = currentPhotoData.realSrc;
        switchToDetailSingleView(); 

        detailTitle.textContent = currentPhotoData.title;
        detailAnimeTitleDisplay.textContent = `アニメ: ${currentPhotoData.animeTitleDisplay}`;
        detailPhotoDescription.value = currentPhotoData.description;
        detailMapElement.innerHTML = '<p style="text-align:center; padding-top: 20px; color: #777;">位置情報を読み込み中...</p>';
        detailStreetviewLink.style.display = 'none';
        detailDatetimeOriginal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 日時情報読み込み中...';
        if (detailMap) { detailMap.remove(); detailMap = null; }
        currentMapMarker = null;
        const exifInfo = currentPhotoData.exif; 
        let mapErrorMessage = exifInfo.error || "位置情報はありません。";
        if (exifInfo.latitude && exifInfo.longitude) {
            requestAnimationFrame(() => {
                setupDetailMap(exifInfo.latitude, exifInfo.longitude, currentPhotoData.title);
                const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${exifInfo.latitude},${exifInfo.longitude}`;
                detailStreetviewLink.href = streetViewUrl;
                detailStreetviewLink.style.display = 'inline-block';
                detailStreetviewLink.innerHTML = `<i class="fas fa-street-view"></i> ストリートビューで見る`;
            });
        } else {
            detailMapElement.innerHTML = `<p style="text-align:center; padding-top: 20px; color: #777;">${mapErrorMessage}</p>`;
        }
        if (exifInfo.dateTimeOriginal) {
            try {
                const date = new Date(exifInfo.dateTimeOriginal);
                if (isNaN(date.getTime())) { throw new Error("Invalid date"); }
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' };
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${date.toLocaleString('ja-JP', options)}`;
            } catch(e) {
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラーの可能性あり)`;
            }
        } else if (exifInfo.error && exifInfo.error.includes("日時情報")) {
             detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        } else {
            detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }
        populateDetailThumbnails(newPhotoId, photosForDetailContext);
    }

    function setupDetailMap(lat, lon, title) {
        detailMapElement.innerHTML = '';
        detailMap = L.map(detailMapElement, { attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(detailMap);
        L.control.attribution({prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="http://osm.org/copyright">OSM</a>'}).addTo(detailMap);
        currentMapMarker = L.marker([lat, lon]).addTo(detailMap).bindPopup(title || '撮影場所');
        detailMap.setView([lat, lon], 12); 
        
        setTimeout(() => {
            if (detailMap) detailMap.invalidateSize();
            if (currentMapMarker) currentMapMarker.openPopup();
        }, 100);
    }
    
    function exitDetailViewAndSwitch(targetView) {
        previousViewBeforeDetail = currentView; // 'detail' を記録 (これが重要)

        detailViewContainer.classList.remove('active-content');
        
        currentPhotoData = null;
        currentPhotoIndexInDetail = -1;
        // lastDetailPhotoLocation は showMapView で参照されるので、ここではクリアしない

        if (detailMap) { detailMap.remove(); detailMap = null; }
        currentMapMarker = null;
        detailThumbnailList.innerHTML = '';

        if (targetView === 'map') {
            showMapView();
        } else { 
            showGalleryView();
        }
    }

    function switchToDetailSingleView() {
        detailSingleImageView.classList.add('active-detail-image-display');
        detailSideBySideView.classList.remove('active-detail-image-display');
        detailToggleComparisonButton.textContent = '左右で比較する';
        isDetailSideBySideActive = false;
    }

    function switchToDetailSideBySideView() {
        detailSingleImageView.classList.remove('active-detail-image-display');
        detailSideBySideView.classList.add('active-detail-image-display');
        detailToggleComparisonButton.textContent = '1枚表示に戻す';
        isDetailSideBySideActive = true;
    }

    detailModalImage.addEventListener('click', () => {
        if (!currentPhotoData) return;
        if (isDetailSideBySideActive) return; 

        if (isRealImageDisplayedInSingleView) {
            detailModalImage.src = currentPhotoData.animeSrc;
        } else {
            detailModalImage.src = currentPhotoData.realSrc;
        }
        isRealImageDisplayedInSingleView = !isRealImageDisplayedInSingleView;
    });

    detailToggleComparisonButton.addEventListener('click', () => {
        if (!currentPhotoData) return;

        if (isDetailSideBySideActive) {
            switchToDetailSingleView();
        } else {
            switchToDetailSideBySideView();
        }
    });

    filterList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');
            const filterType = event.target.dataset.filter;

            if (currentView === 'detail') {
                // 詳細表示中にフィルター変更 → ギャラリーに戻ってフィルター適用
                exitDetailViewAndSwitch('gallery'); 
            } else if (currentView === 'map') {
                // マップ表示中にフィルター変更 → マップを更新
                // この時、詳細から戻ったわけではないので、fitBoundsを優先
                previousViewBeforeDetail = 'map'; // fitBoundsの挙動制御のため
                lastDetailPhotoLocation = null;   // fitBoundsを優先させる
                
                currentFilteredPhotosForMap = (filterType === 'all')
                    ? allPhotosData.filter(photo => photo.exif && photo.exif.latitude && photo.exif.longitude)
                    : allPhotosData.filter(photo => photo.animeFilterTag === filterType && photo.exif && photo.exif.latitude && photo.exif.longitude);
                plotMarkersOnMainMap(currentFilteredPhotosForMap); // ここでfitBounds等が起こる
                if (mainMap) mainMap.invalidateSize();
            } else if (currentView === 'gallery') {
                filterAndDisplayPhotosInGallery(filterType);
            }
        }
    });
    
    toggleMainViewButton.addEventListener('click', () => {
        if (currentView === 'gallery') {
            previousViewBeforeDetail = 'gallery'; // ギャラリーからマップへ
            lastDetailPhotoLocation = null; // fitBoundsを優先させる
            showMapView();
        } else if (currentView === 'map') {
            previousViewBeforeDetail = 'map'; // マップからギャラリーへ
            showGalleryView();
        }
    });

    returnToGalleryButton.addEventListener('click', () => {
        exitDetailViewAndSwitch('gallery');
    });

    returnToMapButton.addEventListener('click', () => {
        exitDetailViewAndSwitch('map');
    });

    function populateDetailThumbnails(activePhotoId, photosForContext) {
        detailThumbnailList.innerHTML = '';
        photosForContext.forEach(photo => {
            const thumbItem = document.createElement('div');
            thumbItem.classList.add('detail-thumbnail-item');
            thumbItem.dataset.photoId = photo.id;
            thumbItem.setAttribute('tabindex', '0');

            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            thumbItem.appendChild(img);

            if (photo.id === activePhotoId) {
                thumbItem.classList.add('active-thumbnail');
            }

            thumbItem.addEventListener('click', () => {
                if (photo.id !== (currentPhotoData ? currentPhotoData.id : -1) ) {
                    openDetailView(photo.id); 
                }
            });
            thumbItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (photo.id !== (currentPhotoData ? currentPhotoData.id : -1) ) {
                        openDetailView(photo.id);
                    }
                }
            });
            detailThumbnailList.appendChild(thumbItem);
        });

        const activeThumb = detailThumbnailList.querySelector('.active-thumbnail');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    document.addEventListener('keydown', (event) => {
        if (currentView !== 'detail' || ['input', 'textarea'].includes(event.target.tagName.toLowerCase())) {
            return;
        }
        
        let photosForNavContext;
        const contextSourceView = previousViewBeforeDetail; 
        if (contextSourceView === 'map') {
            photosForNavContext = [...currentFilteredPhotosForMap];
        } else {
            photosForNavContext = [...currentFilteredPhotosForGallery];
        }

        if (currentPhotoIndexInDetail < 0 || currentPhotoIndexInDetail >= photosForNavContext.length) {
            return;
        }

        let newIndex = currentPhotoIndexInDetail;
        let navigated = false;

        if (event.key === 'ArrowLeft') {
            if (currentPhotoIndexInDetail > 0) {
                newIndex = currentPhotoIndexInDetail - 1;
                navigated = true;
            }
        } else if (event.key === 'ArrowRight') {
            if (currentPhotoIndexInDetail < photosForNavContext.length - 1) {
                newIndex = currentPhotoIndexInDetail + 1;
                navigated = true;
            }
        }

        if (navigated && newIndex !== currentPhotoIndexInDetail) {
            event.preventDefault();
            const nextPhotoId = photosForNavContext[newIndex].id;
            openDetailView(nextPhotoId); 

            const newActiveThumb = detailThumbnailList.querySelector(`.detail-thumbnail-item[data-photo-id="${nextPhotoId}"]`);
            if (newActiveThumb) {
                newActiveThumb.focus();
            }
        }
    });

    let canNavigateByWheel = true;
    const WHEEL_NAVIGATION_COOLDOWN = 300;
    detailViewContainer.addEventListener('wheel', (event) => {
        if (currentView !== 'detail') return;

        const target = event.target;
        const infoPane = document.getElementById('detail-view-info-pane');
        const photoDescription = document.getElementById('detail-photo-description');
        const thumbnailList = document.getElementById('detail-thumbnail-list');
        const mapInDetail = document.getElementById('detail-map-element'); 

        if (photoDescription.contains(target) || 
            thumbnailList.contains(target) ||
            mapInDetail.contains(target) || 
            (target.closest && (
                target.closest('.leaflet-map-pane') || 
                target.closest('.leaflet-control')
            ))) {
            return;
        }

        if (infoPane.contains(target) && infoPane.scrollHeight > infoPane.clientHeight) {
            const isScrollingUp = event.deltaY < 0;
            const isAtTop = infoPane.scrollTop === 0;
            const isAtBottom = infoPane.scrollTop >= (infoPane.scrollHeight - infoPane.clientHeight - 1);
            if ((isScrollingUp && !isAtTop) || (!isScrollingUp && !isAtBottom)) {
                return;
            }
        }
        
        if (event.deltaY === 0) return;
        if (!canNavigateByWheel) { event.preventDefault(); return; }
        
        let photosForNavContext;
        const contextSourceView = previousViewBeforeDetail;
        if (contextSourceView === 'map') {
            photosForNavContext = [...currentFilteredPhotosForMap];
        } else {
            photosForNavContext = [...currentFilteredPhotosForGallery];
        }
        
        if (currentPhotoIndexInDetail < 0 || currentPhotoIndexInDetail >= photosForNavContext.length) {
            return;
        }

        let newIndex = currentPhotoIndexInDetail;
        let performNavigation = false;

        if (event.deltaY < 0) {
            if (currentPhotoIndexInDetail > 0) {
                newIndex = currentPhotoIndexInDetail - 1;
                performNavigation = true;
            }
        } else if (event.deltaY > 0) {
            if (currentPhotoIndexInDetail < photosForNavContext.length - 1) {
                newIndex = currentPhotoIndexInDetail + 1;
                performNavigation = true;
            }
        }

        if (performNavigation) {
            event.preventDefault();
            canNavigateByWheel = false;
            const nextPhotoId = photosForNavContext[newIndex].id;
            Promise.resolve(openDetailView(nextPhotoId)).finally(() => {
                setTimeout(() => { canNavigateByWheel = true; }, WHEEL_NAVIGATION_COOLDOWN);
            });
        }
    }, { passive: false });

    loadPhotoData();
});
