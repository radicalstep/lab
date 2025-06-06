// 写真データの読み込み、EXIF情報の取得・処理、および写真データの管理を行うクラス
class PhotoDataService {
    // PhotoDataServiceのインスタンスを初期化します。
    // @param {string} jsonPath - 写真データが記述されたJSONファイルへのパス。
    constructor(jsonPath = 'photos.json') {
        this.jsonPath = jsonPath;
        this.allPhotosData = [];
    }

    // JSONファイルから写真データを非同期に読み込み、各写真のEXIF情報を処理します。
    // 処理済みの写真データ配列を返します。
    // @returns {Promise<Array<Object>>} EXIF情報が付与された写真データの配列。
    // @throws {Error} データ読み込みまたはEXIF処理に失敗した場合。
    async loadAndProcessPhotos() {
        try {
            const response = await fetch(this.jsonPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawPhotos = await response.json();
            this.allPhotosData = await this._processAllPhotosExif(rawPhotos);
            return this.allPhotosData;
        } catch (error) {
            console.error("写真データの読み込みまたはEXIF処理に失敗しました:", error);
            throw error;
        }
    }

    // 内部メソッド: 全ての写真データに対してEXIF情報を非同期に取得・処理します。
    async _processAllPhotosExif(photos) {
        const photosWithExifPromises = photos.map(async(photo) => {
            const exif = await this._fetchExifDataWithExifJS(photo.realSrc);
            return { ...photo,
                exif
            };
        });
        return Promise.all(photosWithExifPromises);
    }

    // 内部メソッド: ExifJSを使用して指定された画像ソースからEXIFデータを取得します。
    _fetchExifDataWithExifJS(imageSrc) {
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
                    let exifInfo = {
                        latitude: null,
                        longitude: null,
                        dateTimeOriginal: null,
                        error: null
                    };

                    if (lat && lon && latRef && lonRef && lat.length === 3 && lon.length === 3) {
                        exifInfo.latitude = PhotoDataService._convertDMSToDD(lat[0].valueOf(), lat[1].valueOf(), lat[2].valueOf(), latRef);
                        exifInfo.longitude = PhotoDataService._convertDMSToDD(lon[0].valueOf(), lon[1].valueOf(), lon[2].valueOf(), lonRef);
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
                resolve({
                    latitude: null,
                    longitude: null,
                    dateTimeOriginal: null,
                    error: "画像読み込み失敗、EXIF取得不可"
                });
            }
            img.src = imageSrc;
        });
    }

    // 度分秒(DMS)形式の地理座標を十進度(DD)形式に変換します。
    // @param {number} degrees - 度。
    // @param {number} minutes - 分。
    // @param {number} seconds - 秒。
    // @param {string} direction - 方向指示子 ("N", "S", "E", "W")。
    // @returns {number} 十進度形式の座標。
    static _convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction === "S" || direction === "W") {
            dd = dd * -1;
        }
        return dd;
    }

    // 全ての写真データのコピーを返します。
    // @returns {Array<Object>} 写真データの配列。
    getAllPhotos() {
        return [...this.allPhotosData];
    }

    // 指定されたIDの写真データを返します。
    // @param {string|number} id - 写真のID。
    // @returns {Object|undefined} 写真データ、見つからない場合はundefined。
    getPhotoById(id) {
        const photoId = parseInt(id);
        return this.allPhotosData.find(p => p.id === photoId);
    }
}

// ビューの基本クラス。表示/非表示/クリア機能を提供します。
class View {
    // Viewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - ビューのコンテナとなるDOM要素。
    constructor(containerElement) {
        if (!containerElement) {
            throw new Error("View constructor requires a containerElement.");
        }
        this.containerElement = containerElement;
    }
    // ビューを表示状態にします。
    show() {
        this.containerElement.classList.add('active-content');
        this.containerElement.style.display = '';
    }
    // ビューを非表示状態にします。
    hide() {
        this.containerElement.classList.remove('active-content');
        this.containerElement.style.display = 'none';
    }
    // ビューの内容をクリアします。
    clear() {
        this.containerElement.innerHTML = '';
    }
}

// フィルターUIの管理とフィルター変更イベントの処理を行うクラス。
class FilterManager {
    // FilterManagerのインスタンスを初期化します。
    // @param {HTMLElement} filterListElement - フィルター項目を表示するリスト要素。
    // @param {Function} onFilterChangeCallback - フィルターが変更されたときに呼び出されるコールバック関数。
    constructor(filterListElement, onFilterChangeCallback) {
        this.filterListElement = filterListElement;
        this.onFilterChange = onFilterChangeCallback;
        this._initEventListeners();
    }

    // 提供された写真データに基づいてフィルターリストを生成します。
    // @param {Array<Object>} allPhotosData - 全ての写真データの配列。
    populateFilters(allPhotosData) {
        this.filterListElement.innerHTML = '';
        const allFilterItem = this._createFilterItem('すべて', 'all', true);
        this.filterListElement.appendChild(allFilterItem);

        const animeFilterMap = new Map();
        allPhotosData.forEach(photo => {
            if (photo.animeFilterTag && !animeFilterMap.has(photo.animeFilterTag)) {
                animeFilterMap.set(photo.animeFilterTag, photo.animeTitleDisplay);
            }
        });

        const animeFilters = Array.from(animeFilterMap.entries())
            .map(([tag, display]) => ({ tag, display }))
            .sort((a, b) => a.display.localeCompare(b.display, 'ja'));

        animeFilters.forEach(filter => {
            const filterItem = this._createFilterItem(filter.display, filter.tag);
            this.filterListElement.appendChild(filterItem);
        });
    }

    // 内部メソッド: 単一のフィルター項目DOM要素を作成します。
    _createFilterItem(text, filterValue, isActive = false) {
        const filterItem = document.createElement('li');
        filterItem.classList.add('filter-item');
        if (isActive) {
            filterItem.classList.add('active');
        }
        filterItem.dataset.filter = filterValue;
        filterItem.textContent = text;
        return filterItem;
    }

    // 内部メソッド: フィルターリストのクリックイベントリスナーを初期化します。
    _initEventListeners() {
        this.filterListElement.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI' && event.target.classList.contains('filter-item')) {
                this.filterListElement.querySelectorAll('.filter-item').forEach(item => item.classList.remove('active'));
                event.target.classList.add('active');
                const filterType = event.target.dataset.filter;
                if (this.onFilterChange) {
                    this.onFilterChange(filterType);
                }
            }
        });
    }

    // 現在アクティブなフィルターの値を取得します。
    // @returns {string} アクティブなフィルターの値（例: "all", "anime_tag"）。
    getActiveFilter() {
        const activeFilterElement = this.filterListElement.querySelector('.filter-item.active');
        return activeFilterElement ? activeFilterElement.dataset.filter : 'all';
    }
}

// 写真ギャラリーの表示を管理するクラス。
class GalleryView extends View {
    // GalleryViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - ギャラリーのコンテナDOM要素。
    // @param {Function} onPhotoSelectCallback - 写真タイルがクリックされたときに呼び出されるコールバック関数。
    constructor(containerElement, onPhotoSelectCallback) {
        super(containerElement);
        this.onPhotoSelect = onPhotoSelectCallback;
    }

    // 指定された写真データをギャラリーに表示します。
    // @param {Array<Object>} photosToDisplay - 表示する写真データの配列。
    displayPhotos(photosToDisplay) {
        this.clear();
        if (!photosToDisplay || photosToDisplay.length === 0) {
            this.containerElement.innerHTML = '<p style="text-align: center; color: #777;">表示する写真がありません。</p>';
            return;
        }
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;
            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            img.loading = 'lazy';
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `<span class="title">${photo.title}</span><span class="anime-title">${photo.animeTitleDisplay}</span>`;
            tile.appendChild(img);
            tile.appendChild(infoDiv);
            this.containerElement.appendChild(tile);
            tile.addEventListener('click', () => {
                if (this.onPhotoSelect) {
                    this.onPhotoSelect(photo.id);
                }
            });
        });
    }
}

// 地図表示とマーカーの管理を行うクラス。
class MapView extends View {
    // MapViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - マップビュー全体のコンテナDOM要素。
    // @param {HTMLElement} mainMapDomElement - Leafletマップを描画するDOM要素。
    // @param {Function} onMarkerClickCallback - マップマーカーのポップアップ内から写真詳細表示が要求されたときに呼び出されるコールバック。
    constructor(containerElement, mainMapDomElement, onMarkerClickCallback) {
        super(containerElement);
        this.mainMapDomElement = mainMapDomElement;
        this.onMarkerClick = onMarkerClickCallback;
        this.mainMap = null;
        this.markerGroup = null;
        this.markerCache = new Map();
        this.currentFilteredPhotosForMap = [];
    }

    // Leafletマップを初期化します。既に初期化済みの場合は何もしません。
    initializeMap() {
        if (!this.mainMap) {
            this.mainMapDomElement.innerHTML = '';
            this.mainMap = L.map(this.mainMapDomElement);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(this.mainMap);
            this.markerGroup = L.featureGroup().addTo(this.mainMap);
        }
    }

    // 指定された写真データに基づいてマップ上にマーカーをプロットします。
    // @param {Array<Object>} photosToPlot - マーカーをプロットする写真データの配列。
    plotMarkers(photosToPlot) {
        this.currentFilteredPhotosForMap = photosToPlot.filter(p => p.exif && p.exif.latitude && p.exif.longitude);

        this.markerGroup.clearLayers();
        this.markerCache.clear();

        const existingMessage = this.mainMapDomElement.querySelector('.map-message-overlay');
        if (existingMessage) existingMessage.remove();

        if (this.currentFilteredPhotosForMap.length === 0) {
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
            this.mainMapDomElement.appendChild(messageOverlay);
            return;
        }

        this.currentFilteredPhotosForMap.forEach(photo => {
            const marker = L.marker([photo.exif.latitude, photo.exif.longitude]);
            marker.photoId = photo.id;
            this.markerCache.set(photo.id, marker);

            const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${photo.exif.latitude},${photo.exif.longitude}&cbp=12,0,0,0,0`;
            const popupContent = `
                <div class="map-popup-custom-content">
                    <img src="${photo.realSrc}" alt="${photo.title}" class="popup-thumbnail map-popup-thumbnail-image" data-photo-id="${photo.id}" style="cursor: pointer;">
                    <strong>${photo.title}</strong><br>
                    アニメ: ${photo.animeTitleDisplay}<br>
                    <div class="map-popup-actions">
                        <a href="#" class="map-popup-detail-link" data-photo-id="${photo.id}">詳細を見る</a>
                        <a href="${streetViewUrl}" target="_blank" class="map-popup-streetview-link" title="ストリートビューで見る">
                            <i class="fas fa-street-view"></i><span class="map-popup-button-text-sr-only">ストリートビュー</span>
                        </a>
                    </div>
                </div>`;
            marker.bindPopup(popupContent);

            marker.on('popupopen', (e) => {
                const popupNode = e.popup.getElement();
                if (popupNode) {
                    const detailLinks = popupNode.querySelectorAll('.map-popup-detail-link, .map-popup-thumbnail-image');
                    detailLinks.forEach(link => {
                        const newLink = link.cloneNode(true);
                        link.parentNode.replaceChild(newLink, link);
                        newLink.addEventListener('click', (event) => {
                            event.preventDefault();
                            const photoId = parseInt(event.target.closest('[data-photo-id]').dataset.photoId);
                            if (this.onMarkerClick) {
                                this.onMarkerClick(photoId);
                            }
                            if (this.mainMap) this.mainMap.closePopup();
                        });
                    });
                }
            });
            this.markerGroup.addLayer(marker);
        });
    }

    // 指定された写真IDに対応するマーカーをアクティブ化（ポップアップ表示など）します。
    // @param {number} photoId - アクティブ化するマーカーの写真ID。
    activateMarkerForPhoto(photoId) {
        if (!this.mainMap || !photoId) return;
        const targetMarker = this.markerCache.get(photoId);
        if (targetMarker) {
            this.mainMap.closePopup();
            if (!this.mainMap.getBounds().contains(targetMarker.getLatLng())) {
                this.mainMap.setView(targetMarker.getLatLng(), this.mainMap.getZoom() < 15 ? 15 : this.mainMap.getZoom());
            }
            targetMarker.openPopup();
        } else {
            console.warn(`MapView: Marker for photo ID ${photoId} not found. It might be filtered out or have no location data.`);
        }
    }

    // Leafletマップのサイズを再計算させ、表示を更新します。コンテナのサイズ変更時に特に重要です。
    invalidateSize() {
        if (this.mainMap) {
            requestAnimationFrame(() => {
                this.mainMap.invalidateSize();
            });
        }
    }

    // 現在のマップの表示状態（中心座標とズームレベル）を取得します。
    // @returns {Object|null} マップの中心座標とズームレベルを含むオブジェクト、またはマップ未初期化の場合はnull。
    getCurrentViewState() {
        if (this.mainMap) {
            return {
                center: this.mainMap.getCenter(),
                zoom: this.mainMap.getZoom()
            };
        }
        return null;
    }

    // 現在表示されているマーカー全体が収まるようにマップの表示範囲を調整します。
    fitBoundsToMarkers() {
        if (this.mainMap && this.markerGroup && this.markerGroup.getLayers().length > 0) {
            const bounds = this.markerGroup.getBounds();
            if (bounds.isValid()) {
                 this.mainMap.fitBounds(bounds.pad(0.2));
            }
        }
    }
    
    // マップの表示を指定された中心座標とズームレベルに設定します。
    // @param {Array<number>} center - 中心の緯度経度 [lat, lng]。
    // @param {number} zoom - ズームレベル。
    setView(center, zoom) {
        if (this.mainMap) {
            this.mainMap.setView(center, zoom);
        }
    }
}

// 写真詳細ビューの表示と操作を管理するクラス。
class DetailView extends View {
    // DetailViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - 詳細ビューのコンテナDOM要素。
    // @param {Object} domElements - 詳細ビュー内の各種DOM要素への参照を持つオブジェクト。
    // @param {Object} callbacks - コールバック関数（戻るボタン、サムネイルクリックなど）を持つオブジェクト。
    constructor(containerElement, domElements, callbacks) {
        super(containerElement);
        this.dom = domElements;
        this.callbacks = callbacks;
        this.currentPhotoData = null;
        this.currentPhotosForContext = [];
        this.currentPhotoIndexInContext = -1;
        this.isRealImageDisplayedInSingleView = true;
        this.isDetailSideBySideActive = false;
        this.detailMap = null;
        this.canNavigateByWheel = true;
        this.WHEEL_NAVIGATION_COOLDOWN = 300;
        this._initEventListeners();
    }

    // 指定された写真データを詳細ビューに表示します。
    // @param {Object} photoData - 表示する写真のデータ。
    // @param {Array<Object>} photosForContext - ナビゲーションコンテキスト用の写真データ配列。
    // @param {number} currentIndex - photosForContext内での現在表示写真のインデックス。
    displayPhotoDetail(photoData, photosForContext, currentIndex) {
        this.currentPhotoData = photoData;
        this.currentPhotosForContext = photosForContext;
        this.currentPhotoIndexInContext = currentIndex;
        if (!this.currentPhotoData) {
            console.error("DetailView: No photo data to display.");
            this.hide();
            return;
        }
        this.dom.rightPaneHeaderTitle.textContent = this.currentPhotoData.title;
        this.dom.modalImage.src = this.currentPhotoData.realSrc;
        this.dom.sbsAnimeImage.src = this.currentPhotoData.animeSrc;
        this.dom.sbsRealImage.src = this.currentPhotoData.realSrc;
        this.dom.title.textContent = this.currentPhotoData.title;
        this.dom.animeTitleDisplay.textContent = `アニメ: ${this.currentPhotoData.animeTitleDisplay}`;
        this.dom.photoDescription.value = this.currentPhotoData.description;
        this._updateExifDisplay(this.currentPhotoData.exif);
        this._setupOrUpdateDetailMap(this.currentPhotoData.exif);
        this._populateThumbnails(this.currentPhotoData.id, this.currentPhotosForContext);
        this._switchToSingleView();
        this.show();
        const activeThumb = this.dom.thumbnailList.querySelector('.active-thumbnail');
        if (activeThumb) {
            activeThumb.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }

    // 内部メソッド: EXIF情報（撮影日時）を整形して表示します。
    _updateExifDisplay(exifInfo) {
        if (exifInfo.dateTimeOriginal) {
            try {
                const date = new Date(exifInfo.dateTimeOriginal);
                if (isNaN(date.getTime())) {
                    throw new Error("Invalid date");
                }
                const options = {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Tokyo'
                };
                this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${date.toLocaleString('ja-JP', options)}`;
            } catch (e) {
                this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラーの可能性あり)`;
            }
        } else if (exifInfo.error && exifInfo.error.includes("日時情報")) {
            this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        } else {
            this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }
    }

    // 内部メソッド: 詳細ビュー内のミニマップを設定または更新します。
    _setupOrUpdateDetailMap(exifInfo) {
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }
        this.dom.mapElement.innerHTML = '';
        if (exifInfo && exifInfo.latitude && exifInfo.longitude) {
            requestAnimationFrame(() => {
                this.detailMap = L.map(this.dom.mapElement, {
                        attributionControl: false
                    })
                    .setView([exifInfo.latitude, exifInfo.longitude], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                }).addTo(this.detailMap);
                L.control.attribution({
                    prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="http://osm.org/copyright">OSM</a>'
                }).addTo(this.detailMap);

                L.marker([exifInfo.latitude, exifInfo.longitude])
                    .addTo(this.detailMap)
                    .bindPopup(this.currentPhotoData.title || '撮影場所');

                setTimeout(() => {
                    if (this.detailMap) {
                        this.detailMap.invalidateSize();
                    }
                }, 100);

                const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${exifInfo.latitude},${exifInfo.longitude}`;
                this.dom.streetviewLink.href = streetViewUrl;
                this.dom.streetviewLink.classList.remove('hidden');
                this.dom.streetviewLink.innerHTML = `<i class="fas fa-street-view"></i> ストリートビューで見る`;
            });
        } else {
            this.dom.mapElement.innerHTML = `<p style="text-align:center; padding-top: 20px; color: #777;">${exifInfo.error || "位置情報はありません。"}</p>`;
            this.dom.streetviewLink.style.display = 'none';
        }
    }

    // 内部メソッド: 詳細ビューのサムネイルリストを生成します。
    _populateThumbnails(activePhotoId, photosForContext) {
        this.dom.thumbnailList.innerHTML = '';
        photosForContext.forEach(photo => {
            const thumbItem = document.createElement('div');
            thumbItem.classList.add('detail-thumbnail-item');
            thumbItem.dataset.photoId = photo.id;
            thumbItem.setAttribute('tabindex', '0');
            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            img.loading = 'lazy';
            thumbItem.appendChild(img);
            if (photo.id === activePhotoId) {
                thumbItem.classList.add('active-thumbnail');
            }
            thumbItem.addEventListener('click', () => {
                if (photo.id !== (this.currentPhotoData ? this.currentPhotoData.id : -1) && this.callbacks.onThumbnailClick) {
                    this.callbacks.onThumbnailClick(photo.id);
                }
            });
            thumbItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (photo.id !== (this.currentPhotoData ? this.currentPhotoData.id : -1) && this.callbacks.onThumbnailClick) {
                        this.callbacks.onThumbnailClick(photo.id);
                    }
                }
            });
            this.dom.thumbnailList.appendChild(thumbItem);
        });
    }

    // 内部メソッド: 詳細ビューの画像表示を1枚表示モードに切り替えます。
    _switchToSingleView() {
        this.dom.singleImageView.classList.add('active-detail-image-display');
        this.dom.sideBySideView.classList.remove('active-detail-image-display');
        this.dom.toggleComparisonButton.textContent = '2枚表示で比較する';
        this.isDetailSideBySideActive = false;
        this.isRealImageDisplayedInSingleView = true;
        if (this.currentPhotoData) this.dom.modalImage.src = this.currentPhotoData.realSrc;
    }

    // 内部メソッド: 詳細ビューの画像表示を2枚比較表示モードに切り替えます。
    _switchToSideBySideView() {
        this.dom.singleImageView.classList.remove('active-detail-image-display');
        this.dom.sideBySideView.classList.add('active-detail-image-display');
        this.dom.toggleComparisonButton.textContent = '1枚表示に戻す';
        this.isDetailSideBySideActive = true;
    }

    // 詳細ビューを非表示にし、関連するリソース（マップなど）をクリーンアップします。
    hideAndCleanup() {
        this.hide();
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }
        this.currentPhotoData = null;
        this.currentPhotosForContext = [];
        this.currentPhotoIndexInContext = -1;
        this.dom.thumbnailList.innerHTML = '';
        this.dom.photoDescription.value = '';
        this.dom.photoDescription.readOnly = true;
    }

    // 内部メソッド: 詳細ビュー内のイベントリスナーを初期化します。
    _initEventListeners() {
        this.dom.modalImage.addEventListener('click', () => {
            if (!this.currentPhotoData || this.isDetailSideBySideActive) return;
            this.isRealImageDisplayedInSingleView = !this.isRealImageDisplayedInSingleView;
            this.dom.modalImage.src = this.isRealImageDisplayedInSingleView ? this.currentPhotoData.realSrc : this.currentPhotoData.animeSrc;
        });
        this.dom.toggleComparisonButton.addEventListener('click', () => {
            if (!this.currentPhotoData) return;
            if (this.isDetailSideBySideActive) {
                this._switchToSingleView();
            } else {
                this._switchToSideBySideView();
            }
        });
        this.dom.returnToGalleryButton.addEventListener('click', () => {
            if (this.callbacks.onReturnToGallery) this.callbacks.onReturnToGallery();
        });
        this.dom.returnToMapButton.addEventListener('click', () => {
            if (this.callbacks.onReturnToMap) this.callbacks.onReturnToMap();
        });
        document.addEventListener('keydown', (event) => {
            if (this.containerElement.classList.contains('active-content')) {
                if (['input', 'textarea'].includes(event.target.tagName.toLowerCase())) return;
                let navigated = false;
                if (event.key === 'ArrowLeft') {
                    if (this.currentPhotoIndexInContext > 0) {
                        this.callbacks.onNavigateToPhoto(this.currentPhotosForContext[this.currentPhotoIndexInContext - 1].id);
                        navigated = true;
                    }
                } else if (event.key === 'ArrowRight') {
                    if (this.currentPhotoIndexInContext < this.currentPhotosForContext.length - 1) {
                        this.callbacks.onNavigateToPhoto(this.currentPhotosForContext[this.currentPhotoIndexInContext + 1].id);
                        navigated = true;
                    }
                }
                if (navigated) event.preventDefault();
            }
        });
        this.containerElement.addEventListener('wheel', (event) => {
            if (!this.containerElement.classList.contains('active-content')) return;
            const target = event.target;
            const infoPane = this.dom.infoPane;
            const photoDescriptionEl = this.dom.photoDescription;
            const thumbnailListEl = this.dom.thumbnailList;
            const mapInDetailEl = this.dom.mapElement;
            if (photoDescriptionEl.contains(target) ||
                thumbnailListEl.contains(target) ||
                mapInDetailEl.contains(target) ||
                (target.closest && (target.closest('.leaflet-map-pane') || target.closest('.leaflet-control')))) {
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
            if (event.deltaY === 0 || !this.canNavigateByWheel) {
                if (!this.canNavigateByWheel) event.preventDefault();
                return;
            }
            let navigated = false;
            if (event.deltaY < 0) {
                if (this.currentPhotoIndexInContext > 0) {
                    this.callbacks.onNavigateToPhoto(this.currentPhotosForContext[this.currentPhotoIndexInContext - 1].id);
                    navigated = true;
                }
            } else if (event.deltaY > 0) {
                if (this.currentPhotoIndexInContext < this.currentPhotosForContext.length - 1) {
                    this.callbacks.onNavigateToPhoto(this.currentPhotosForContext[this.currentPhotoIndexInContext + 1].id);
                    navigated = true;
                }
            }
            if (navigated) {
                event.preventDefault();
                this.canNavigateByWheel = false;
                setTimeout(() => {
                    this.canNavigateByWheel = true;
                }, this.WHEEL_NAVIGATION_COOLDOWN);
            }
        }, {
            passive: false
        });
    }
}

// 写真ギャラリーアプリケーション全体の制御を行うメインクラス。
class PhotoApp {
    // アプリケーションの定数
    static DEFAULT_MAP_CENTER = [36, 138]; // マーカーがない場合のデフォルト中心位置 (日本の概ね中心)
    static DEFAULT_MAP_ZOOM = 7; // マーカーがない場合のデフォルトズームレベル
    static DETAIL_MAP_ZOOM_FROM_GALLERY = 15; // 詳細からマップに戻った際のズームレベル
    static SINGLE_MARKER_MAP_ZOOM = 12; // 単一マーカー表示時のデフォルトズーム (現在未使用)
    static MARKER_ACTIVATION_DELAY = 150; // マーカーアクティブ化の遅延時間 (ms)

    // PhotoAppのインスタンスを初期化します。DOM要素の取得、各モジュールの初期化を行います。
    constructor() {
        this.dom = {
            filterList: document.getElementById('filter-list'),
            rightPaneHeaderTitle: document.getElementById('right-pane-header-title'),
            photoGalleryContainer: document.getElementById('photo-gallery-container'),
            detailViewContainer: document.getElementById('detail-view-container'),
            mapViewContainer: document.getElementById('map-view-container'),
            mainMapElement: document.getElementById('main-map-element'),
            toggleMainViewButton: document.getElementById('toggle-main-view-button'),
            returnToGalleryButton: document.getElementById('return-to-gallery-button'),
            returnToMapButton: document.getElementById('return-to-map-button'),
            detail: {
                rightPaneHeaderTitle: document.getElementById('right-pane-header-title'),
                modalImage: document.getElementById('detail-modal-image'),
                sbsAnimeImage: document.getElementById('detail-sbs-anime-image'),
                sbsRealImage: document.getElementById('detail-sbs-real-image'),
                toggleComparisonButton: document.getElementById('detail-toggle-comparison-button'),
                title: document.getElementById('detail-title'),
                animeTitleDisplay: document.getElementById('detail-anime-title-display'),
                photoDescription: document.getElementById('detail-photo-description'),
                datetimeOriginal: document.getElementById('detail-datetime-original'),
                mapElement: document.getElementById('detail-map-element'),
                streetviewLink: document.getElementById('detail-streetview-link'),
                singleImageView: document.getElementById('detail-single-image-view'),
                sideBySideView: document.getElementById('detail-side-by-side-view'),
                thumbnailList: document.getElementById('detail-thumbnail-list'),
                infoPane: document.getElementById('detail-view-info-pane'),
                returnToGalleryButton: document.getElementById('return-to-gallery-button'),
                returnToMapButton: document.getElementById('return-to-map-button')
            }
        };

        this.photoDataService = new PhotoDataService('photos.json');
        this.filterManager = new FilterManager(this.dom.filterList, this.handleFilterChange.bind(this));
        this.galleryView = new GalleryView(this.dom.photoGalleryContainer, this.handlePhotoSelect.bind(this));
        this.mapView = new MapView(this.dom.mapViewContainer, this.dom.mainMapElement, this.handlePhotoSelect.bind(this));
        const detailViewCallbacks = {
            onReturnToGallery: () => this.switchToView('gallery'),
            onReturnToMap: () => this.switchToView('map'),
            onThumbnailClick: (photoId) => this.openDetailView(photoId),
            onNavigateToPhoto: (photoId) => this.openDetailView(photoId)
        };
        this.detailView = new DetailView(this.dom.detailViewContainer, this.dom.detail, detailViewCallbacks);

        this.allPhotos = [];
        this.currentFilteredPhotos = [];
        this.currentView = 'gallery';
        this.previousViewBeforeDetail = 'gallery';
        this.lastDetailPhotoLocation = null;
        this.lastOpenedDetailPhotoId = null;
        this.isFirstMapLoad = true;
        this.mapLastCenter = [...PhotoApp.DEFAULT_MAP_CENTER];
        this.mapLastZoom = PhotoApp.DEFAULT_MAP_ZOOM;
        this.mapShouldFitBoundsOnFilterChange = false;
    }

    // アプリケーションを非同期に初期化します。写真データの読み込み、フィルター設定、初期ビュー表示を行います。
    async init() {
        try {
            this.allPhotos = await this.photoDataService.loadAndProcessPhotos();
            this.filterManager.populateFilters(this.allPhotos);
            this.handleFilterChange(this.filterManager.getActiveFilter());
            this.switchToView('gallery');
            this._initGlobalEventListeners();
        } catch (error) {
            this.dom.photoGalleryContainer.innerHTML = `<p style="color: red; text-align: center;">アプリケーションの初期化に失敗しました。詳細: ${error.message}</p>`;
            console.error("App initialization failed:", error);
        }
    }

    // 内部メソッド: グローバルなイベントリスナー（ビュー切り替えボタンなど）を初期化します。
    _initGlobalEventListeners() {
        this.dom.toggleMainViewButton.addEventListener('click', () => {
            if (this.currentView === 'gallery') {
                this.mapShouldFitBoundsOnFilterChange = false;
                this.switchToView('map');
            } else if (this.currentView === 'map') {
                this.switchToView('gallery');
            }
        });
    }

    // フィルターが変更された際の処理を行います。写真リストを更新し、現在のビューを再表示します。
    // @param {string} filterType - 選択されたフィルターの種類（"all" またはアニメタグ）。
    handleFilterChange(filterType) {
        this.currentFilteredPhotos = (filterType === 'all' || !filterType) ?
            [...this.allPhotos] :
            this.allPhotos.filter(photo => photo.animeFilterTag === filterType);

        this.lastDetailPhotoLocation = null;
        this.lastOpenedDetailPhotoId = null;

        if (this.currentView === 'gallery') {
            this.galleryView.displayPhotos(this.currentFilteredPhotos);
        } else if (this.currentView === 'map') {
            this.mapShouldFitBoundsOnFilterChange = true;
            this.switchToView('map');
        } else if (this.currentView === 'detail') {
            this.switchToView('gallery');
        }
    }

    // 写真が選択された際の処理（ギャラリーまたはマップから）。詳細ビューを開きます。
    // @param {number} photoId - 選択された写真のID。
    handlePhotoSelect(photoId) {
        this.openDetailView(photoId);
    }

    // 指定された写真IDの詳細ビューを開きます。
    // @param {number} photoId - 表示する写真のID。
    openDetailView(photoId) {
        const photoToDisplay = this.photoDataService.getPhotoById(photoId);
        if (!photoToDisplay) {
            console.error(`Photo with ID ${photoId} not found.`);
            return;
        }

        if (this.currentView !== 'detail') {
            this.previousViewBeforeDetail = this.currentView;
            if (this.currentView === 'map' && this.mapView.mainMap) {
                const currentMapState = this.mapView.getCurrentViewState();
                if (currentMapState) {
                    this.mapLastCenter = [currentMapState.center.lat, currentMapState.center.lng];
                    this.mapLastZoom = currentMapState.zoom;
                }
            }
        }

        let contextPhotosForDetailNav;
        if (this.previousViewBeforeDetail === 'map') {
            contextPhotosForDetailNav = this.mapView.currentFilteredPhotosForMap;
        } else {
            const activeFilter = this.filterManager.getActiveFilter();
            contextPhotosForDetailNav = (activeFilter === 'all' || !activeFilter) ?
                [...this.allPhotos] :
                this.allPhotos.filter(photo => photo.animeFilterTag === activeFilter);
        }
        
        const currentIndexInContext = contextPhotosForDetailNav.findIndex(p => p.id === photoToDisplay.id);

        if (photoToDisplay.exif && photoToDisplay.exif.latitude && photoToDisplay.exif.longitude) {
            this.lastDetailPhotoLocation = [photoToDisplay.exif.latitude, photoToDisplay.exif.longitude];
        } else {
            this.lastDetailPhotoLocation = null;
        }
        this.lastOpenedDetailPhotoId = photoToDisplay.id;

        this.currentView = 'detail';
        this.galleryView.hide();
        this.mapView.hide();
        this.detailView.displayPhotoDetail(photoToDisplay, contextPhotosForDetailNav, currentIndexInContext);
        this._updateHeaderAndControls();
    }

    // 指定されたビュー名にアプリケーションの表示を切り替えます。
    // @param {string} viewName - 切り替え先のビュー名 ("gallery", "map", "detail")。
    switchToView(viewName) {
        const previousActualView = this.currentView;

        if (this.currentView === 'detail') {
            this.detailView.hideAndCleanup();
        }

        if (previousActualView === 'map' && viewName !== 'map' && this.mapView.mainMap) {
            const currentMapState = this.mapView.getCurrentViewState();
            if (currentMapState) {
                this.mapLastCenter = [currentMapState.center.lat, currentMapState.center.lng];
                this.mapLastZoom = currentMapState.zoom;
            }
        }

        this.currentView = viewName;

        this.galleryView.hide();
        this.mapView.hide();

        if (viewName === 'gallery') {
            this.dom.rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
            this.galleryView.displayPhotos(this.currentFilteredPhotos);
            this.galleryView.show();
        } else if (viewName === 'map') {
            this.dom.rightPaneHeaderTitle.textContent = '聖地マップ';
            this.mapView.initializeMap();

            const photosForMap = this.currentFilteredPhotos.filter(p => p.exif && p.exif.latitude && p.exif.longitude);
            this.mapView.plotMarkers(photosForMap);

            this.mapView.show();
            this.mapView.invalidateSize();

            let viewSetBySpecificCondition = false;

            if (previousActualView === 'detail' && this.lastDetailPhotoLocation) {
                this.mapView.setView(this.lastDetailPhotoLocation, PhotoApp.DETAIL_MAP_ZOOM_FROM_GALLERY);
                viewSetBySpecificCondition = true;
            }
            else if (this.isFirstMapLoad) {
                if (this.mapView.currentFilteredPhotosForMap.length > 0) {
                    setTimeout(() => {
                        this.mapView.fitBoundsToMarkers();
                    }, 100); 
                } else {
                    this.mapView.setView(PhotoApp.DEFAULT_MAP_CENTER, PhotoApp.DEFAULT_MAP_ZOOM);
                }
                this.isFirstMapLoad = false;
                viewSetBySpecificCondition = true;
            }
            else if (this.mapShouldFitBoundsOnFilterChange) {
                if (this.mapView.currentFilteredPhotosForMap.length > 0) {
                    this.mapView.fitBoundsToMarkers();
                } else {
                    this.mapView.setView(this.mapLastCenter, this.mapLastZoom);
                }
                this.mapShouldFitBoundsOnFilterChange = false;
                viewSetBySpecificCondition = true;
            }

            if (!viewSetBySpecificCondition && this.mapView.mainMap) {
                this.mapView.setView(this.mapLastCenter, this.mapLastZoom);
            }

            if (previousActualView === 'detail' && this.lastOpenedDetailPhotoId !== null) {
                setTimeout(() => {
                    if (this.mapView.mainMap) {
                        this.mapView.activateMarkerForPhoto(this.lastOpenedDetailPhotoId);
                    }
                }, PhotoApp.MARKER_ACTIVATION_DELAY);
            } else {
                 this.lastOpenedDetailPhotoId = null;
            }
        }
        this._updateHeaderAndControls();
    }

    // 内部メソッド: 現在のビューに応じてヘッダータイトルやコントロールボタンの表示を更新します。
    _updateHeaderAndControls() {
        if (this.currentView === 'gallery') {
            this.dom.toggleMainViewButton.textContent = 'マップで表示';
            this.dom.toggleMainViewButton.style.display = 'inline-block';
            this.dom.returnToGalleryButton.style.display = 'none';
            this.dom.returnToMapButton.style.display = 'none';
        } else if (this.currentView === 'map') {
            this.dom.toggleMainViewButton.textContent = 'ギャラリーで表示';
            this.dom.toggleMainViewButton.style.display = 'inline-block';
            this.dom.returnToGalleryButton.style.display = 'none';
            this.dom.returnToMapButton.style.display = 'none';
        } else if (this.currentView === 'detail') {
            this.dom.toggleMainViewButton.style.display = 'none';
            this.dom.returnToGalleryButton.style.display = 'inline-block';
            this.dom.returnToMapButton.style.display = 'inline-block';

            if (this.previousViewBeforeDetail === 'map') {
                this.dom.returnToMapButton.classList.add('primary-return-button');
                this.dom.returnToGalleryButton.classList.remove('primary-return-button');
            } else {
                this.dom.returnToGalleryButton.classList.add('primary-return-button');
                this.dom.returnToMapButton.classList.remove('primary-return-button');
            }
        }
    }
}

// DOMContentLoadedイベントでPhotoAppを初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoApp();
    app.init();
});
