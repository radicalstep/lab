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

    async _processAllPhotosExif(photos) {
        const photosWithExifPromises = photos.map(async (photo) => {
            const exif = await this._fetchExifDataWithExifJS(photo.realSrc);
            return { ...photo, exif };
        });
        return Promise.all(photosWithExifPromises);
    }

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
                    let exifInfo = { latitude: null, longitude: null, dateTimeOriginal: null, error: null };

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
                resolve({ latitude: null, longitude: null, dateTimeOriginal: null, error: "画像読み込み失敗、EXIF取得不可" });
            }
            img.src = imageSrc;
        });
    }

    static _convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction === "S" || direction === "W") { dd = dd * -1; }
        return dd;
    }

    // 現在保持している全ての写真データのコピーを返します。
    // @returns {Array<Object>} 全ての写真データの配列。
    getAllPhotos() {
        return [...this.allPhotosData];
    }

    // 指定されたIDの写真データを返します。
    // @param {number|string} id - 検索する写真のID。
    // @returns {Object|undefined} 見つかった写真データ、または見つからない場合はundefined。
    getPhotoById(id) {
        const photoId = parseInt(id);
        return this.allPhotosData.find(p => p.id === photoId);
    }
}

// UI要素の表示・非表示・内容クリアといった基本的なビュー操作を提供する基底クラス
class View {
    // Viewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - このビューが管理するDOMコンテナ要素。
    // @throws {Error} containerElementが指定されていない場合。
    constructor(containerElement) {
        if (!containerElement) {
            throw new Error("View constructor requires a containerElement.");
        }
        this.containerElement = containerElement;
    }

    // このビューのコンテナ要素を表示状態にします。
    show() {
        this.containerElement.classList.add('active-content');
        this.containerElement.style.display = '';
    }

    // このビューのコンテナ要素を非表示状態にします。
    hide() {
        this.containerElement.classList.remove('active-content');
        this.containerElement.style.display = 'none';
    }

    // このビューのコンテナ要素の内容を空にします。
    clear() {
        this.containerElement.innerHTML = '';
    }
}

// 写真をフィルタリングするためのUI（フィルターリスト）を管理し、
// フィルター変更イベントを処理するクラス
class FilterManager {
    // FilterManagerのインスタンスを初期化します。
    // @param {HTMLElement} filterListElement - フィルター項目を表示するリスト要素。
    // @param {Function} onFilterChangeCallback - フィルターが変更されたときに呼び出されるコールバック関数。
    constructor(filterListElement, onFilterChangeCallback) {
        this.filterListElement = filterListElement;
        this.onFilterChange = onFilterChangeCallback;
        this._initEventListeners();
    }

    // 提供された写真データに基づいてフィルターリストを生成し、表示します。
    // @param {Array<Object>} allPhotosData - フィルター生成の元となる全写真データの配列。
    populateFilters(allPhotosData) {
        this.filterListElement.innerHTML = '';
        const allFilterItem = this._createFilterItem('すべて', 'all', true);
        this.filterListElement.appendChild(allFilterItem);

        const animeFilters = [];
        allPhotosData.forEach(photo => {
            if (!animeFilters.some(f => f.tag === photo.animeFilterTag)) {
                animeFilters.push({ tag: photo.animeFilterTag, display: photo.animeTitleDisplay });
            }
        });
        animeFilters.sort((a, b) => a.display.localeCompare(b.display, 'ja'));
        animeFilters.forEach(filter => {
            const filterItem = this._createFilterItem(filter.display, filter.tag);
            this.filterListElement.appendChild(filterItem);
        });
    }

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

    // 現在選択されている（アクティブな）フィルターの値を返します。
    // @returns {string} アクティブなフィルターの値。デフォルトは'all'。
    getActiveFilter() {
        const activeFilterElement = this.filterListElement.querySelector('.filter-item.active');
        return activeFilterElement ? activeFilterElement.dataset.filter : 'all';
    }
}

// 写真をギャラリー形式（タイル表示）で表示するためのビュークラス。Viewクラスを継承します。
class GalleryView extends View {
    // GalleryViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - ギャラリーを表示するコンテナ要素。
    // @param {Function} onPhotoSelectCallback - 写真タイルがクリックされたときに呼び出されるコールバック関数。
    constructor(containerElement, onPhotoSelectCallback) {
        super(containerElement);
        this.onPhotoSelect = onPhotoSelectCallback;
    }

    // 指定された写真データの配列をギャラリーに表示します。
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

// 地図上に写真の位置情報をマーカーとして表示するためのビュークラス。Viewクラスを継承します。
class MapView extends View {
    // MapViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - マップビュー全体のコンテナ要素。
    // @param {HTMLElement} mainMapDomElement - Leafletマップを描画するDOM要素。
    // @param {Function} onMarkerClickCallback - マップ上のマーカーがクリックされたときに呼び出されるコールバック関数。
    constructor(containerElement, mainMapDomElement, onMarkerClickCallback) {
        super(containerElement);
        this.mainMapDomElement = mainMapDomElement;
        this.onMarkerClick = onMarkerClickCallback;
        this.mainMap = null;
        this.mainMapMarkers = [];
        this.currentFilteredPhotosForMap = [];
    }

    // Leafletマップを初期化します。マップがまだ存在しない場合のみ作成します。
    initializeMap() {
        if (!this.mainMap) {
            this.mainMapDomElement.innerHTML = '';
            this.mainMap = L.map(this.mainMapDomElement).setView([36, 138], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(this.mainMap);
        }
    }

    // 指定された写真データの位置情報をマップ上にマーカーとしてプロットします。
    // @param {Array<Object>} photosToPlot - マップにプロットする写真データの配列。
    // @param {boolean} [fitBounds=true] - マーカー全体が表示されるようにマップの表示範囲を調整するかどうか。
    // @param {Array<number>|null} [targetLocation=null] - 特定の座標 [緯度, 経度] を中心に表示する場合、その座標。
    plotMarkers(photosToPlot, fitBounds = true, targetLocation = null) {
        this.currentFilteredPhotosForMap = photosToPlot.filter(p => p.exif && p.exif.latitude && p.exif.longitude);
        
        this.mainMapMarkers.forEach(marker => marker.remove());
        this.mainMapMarkers = [];
        const markerCoordinates = [];

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
            if (this.mainMap) this.mainMap.setView([36, 138], 5);
            return;
        }
        
        this.currentFilteredPhotosForMap.forEach(photo => {
            const marker = L.marker([photo.exif.latitude, photo.exif.longitude]);
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

            this.mainMapMarkers.push(marker);
            markerCoordinates.push([photo.exif.latitude, photo.exif.longitude]);
        });

        if (this.mainMapMarkers.length > 0) {
            L.featureGroup(this.mainMapMarkers).addTo(this.mainMap);
        }

        if (targetLocation) {
            this.mainMap.setView(targetLocation, 15);
        } else if (fitBounds) {
            if (markerCoordinates.length > 1) {
                this.mainMap.fitBounds(L.latLngBounds(markerCoordinates).pad(0.2));
            } else if (markerCoordinates.length === 1) {
                this.mainMap.setView(markerCoordinates[0], 12);
            } else {
                 if(this.mainMap) this.mainMap.setView([36, 138], 5);
            }
        }
        requestAnimationFrame(() => {
            if (this.mainMap) this.mainMap.invalidateSize();
        });
    }

    // マップのサイズを再計算し、正しく表示されるようにします。
    // 特に、ビューが表示状態に変わった後などに呼び出します。
    invalidateSize() {
        if (this.mainMap) {
            requestAnimationFrame(() => {
                 this.mainMap.invalidateSize();
            });
        }
    }
}

// 個々の写真の詳細情報を表示するためのビュークラス。Viewクラスを継承します。
// 画像、アニメシーンとの比較、EXIF情報、地図上の位置、説明などを表示します。
class DetailView extends View {
    // DetailViewのインスタンスを初期化します。
    // @param {HTMLElement} containerElement - 詳細ビュー全体のコンテナ要素。
    // @param {Object} domElements - 詳細ビュー内で使用する関連DOM要素のコレクション。
    // @param {Object} callbacks - 各種操作（ギャラリーへ戻る、サムネイルクリックなど）に対応するコールバック関数のコレクション。
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

    // 指定された写真データとそのコンテキスト情報（ナビゲーション用の写真リストなど）を基に、詳細情報を表示します。
    // @param {Object} photoData - 表示する写真のデータ。
    // @param {Array<Object>} photosForContext - 現在のナビゲーションコンテキストにおける写真のリスト。
    // @param {number} currentIndex - `photosForContext`内での現在の写真のインデックス。
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
        this.dom.photoDescription.readOnly = false; 

        this._updateExifDisplay(this.currentPhotoData.exif);
        this._setupOrUpdateDetailMap(this.currentPhotoData.exif);
        this._populateThumbnails(this.currentPhotoData.id, this.currentPhotosForContext);
        this._switchToSingleView();
        
        this.show();

        const activeThumb = this.dom.thumbnailList.querySelector('.active-thumbnail');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    _updateExifDisplay(exifInfo) {
        if (exifInfo.dateTimeOriginal) {
            try {
                const date = new Date(exifInfo.dateTimeOriginal);
                if (isNaN(date.getTime())) { throw new Error("Invalid date"); }
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' };
                this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${date.toLocaleString('ja-JP', options)}`;
            } catch(e) {
                this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラーの可能性あり)`;
            }
        } else if (exifInfo.error && exifInfo.error.includes("日時情報")) {
             this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        } else {
            this.dom.datetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }
    }

    _setupOrUpdateDetailMap(exifInfo) {
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }
        this.dom.mapElement.innerHTML = '';

        if (exifInfo && exifInfo.latitude && exifInfo.longitude) {
            requestAnimationFrame(() => {
                this.detailMap = L.map(this.dom.mapElement, { attributionControl: false })
                    .setView([exifInfo.latitude, exifInfo.longitude], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.detailMap);
                L.control.attribution({prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="http://osm.org/copyright">OSM</a>'}).addTo(this.detailMap);
                const marker = L.marker([exifInfo.latitude, exifInfo.longitude])
                    .addTo(this.detailMap)
                    .bindPopup(this.currentPhotoData.title || '撮影場所');
                
                setTimeout(() => {
                    if (this.detailMap) this.detailMap.invalidateSize();
                    marker.openPopup();
                }, 100);

                const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${exifInfo.latitude},${exifInfo.longitude}`;
                this.dom.streetviewLink.href = streetViewUrl;
                this.dom.streetviewLink.style.display = 'inline-block';
                this.dom.streetviewLink.innerHTML = `<i class="fas fa-street-view"></i> ストリートビューで見る`;
            });
        } else {
            this.dom.mapElement.innerHTML = `<p style="text-align:center; padding-top: 20px; color: #777;">${exifInfo.error || "位置情報はありません。"}</p>`;
            this.dom.streetviewLink.style.display = 'none';
        }
    }

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

    _switchToSingleView() {
        this.dom.singleImageView.classList.add('active-detail-image-display');
        this.dom.sideBySideView.classList.remove('active-detail-image-display');
        this.dom.toggleComparisonButton.textContent = '左右で比較する';
        this.isDetailSideBySideActive = false;
        this.isRealImageDisplayedInSingleView = true;
        if(this.currentPhotoData) this.dom.modalImage.src = this.currentPhotoData.realSrc;
    }

    _switchToSideBySideView() {
        this.dom.singleImageView.classList.remove('active-detail-image-display');
        this.dom.sideBySideView.classList.add('active-detail-image-display');
        this.dom.toggleComparisonButton.textContent = '1枚表示に戻す';
        this.isDetailSideBySideActive = true;
    }
    
    // 詳細ビューを非表示にし、関連するリソース（マップインスタンスなど）をクリーンアップします。
    // また、現在の写真データやコンテキスト情報をリセットします。
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
                if (['input', 'textarea'].includes(event.target.tagName.toLowerCase())) {
                    return;
                }
                
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
                if(!this.canNavigateByWheel) event.preventDefault(); 
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
                setTimeout(() => { this.canNavigateByWheel = true; }, this.WHEEL_NAVIGATION_COOLDOWN);
            }
        }, { passive: false }); 
    }
}

// 写真表示アプリケーション全体の制御を行うメインクラス。
// データサービス、フィルター管理、各ビュー（ギャラリー、マップ、詳細）を統合し、
// ユーザーインタラクションに応じてアプリケーションの状態を管理します。
class PhotoApp {
    // PhotoAppのインスタンスを初期化します。
    // アプリケーションに必要なDOM要素の参照を保持し、各コンポーネント（Service, Manager, Views）をセットアップします。
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
    }

    // アプリケーションを非同期に初期化します。
    // 写真データをロードし、フィルターを初期化し、最初のビュー（ギャラリー）を表示します。
    // グローバルなイベントリスナーも設定します。
    // @returns {Promise<void>}
    // @throws {Error} 初期化プロセス中にエラーが発生した場合。
    async init() {
        try {
            this.allPhotos = await this.photoDataService.loadAndProcessPhotos();
            this.filterManager.populateFilters(this.allPhotos);
            this.switchToView('gallery');
            this._initGlobalEventListeners();
        } catch (error) {
            this.dom.photoGalleryContainer.innerHTML = `<p style="color: red; text-align: center;">アプリケーションの初期化に失敗しました。詳細: ${error.message}</p>`;
        }
    }

    _initGlobalEventListeners() {
        this.dom.toggleMainViewButton.addEventListener('click', () => {
            if (this.currentView === 'gallery') {
                this.switchToView('map');
            } else if (this.currentView === 'map') {
                this.switchToView('gallery');
            }
        });
    }

    // フィルターが変更された際のハンドラ関数。
    // 選択されたフィルターに基づいて写真リストを更新し、現在のビュー（ギャラリーまたはマップ）を再表示します。
    // 詳細ビュー表示中にフィルターが変更された場合は、ギャラリービューに切り替えます。
    // @param {string} filterType - 選択されたフィルターのタイプ（タグ）。
    handleFilterChange(filterType) {
        this.currentFilteredPhotos = (filterType === 'all' || !filterType)
            ? [...this.allPhotos]
            : this.allPhotos.filter(photo => photo.animeFilterTag === filterType);

        if (this.currentView === 'gallery') {
            this.galleryView.displayPhotos(this.currentFilteredPhotos);
        } else if (this.currentView === 'map') {
            this.mapView.plotMarkers(this.currentFilteredPhotos, true);
            this.lastDetailPhotoLocation = null;
        } else if (this.currentView === 'detail') {
            this.switchToView('gallery');
        }
    }

    // 写真が選択された際のハンドラ関数（ギャラリーまたはマップのマーカーから）。
    // 選択された写真の詳細ビューを開きます。
    // @param {number|string} photoId - 選択された写真のID。
    handlePhotoSelect(photoId) {
        this.openDetailView(photoId);
    }

    // 指定されたIDの写真の詳細ビューを開きます。
    // 現在のビューが詳細ビューでなければ、それを記憶し、ナビゲーションコンテキストを設定します。
    // 詳細ビューに必要なデータを渡し、表示を更新します。
    // @param {number|string} photoId - 表示する写真のID。
    openDetailView(photoId) {
        const photoToDisplay = this.photoDataService.getPhotoById(photoId);
        if (!photoToDisplay) {
            console.error(`Photo with ID ${photoId} not found.`);
            return;
        }

        if (this.currentView !== 'detail') {
            this.previousViewBeforeDetail = this.currentView;
        }
        
        let contextPhotosForDetailNav;
        if (this.previousViewBeforeDetail === 'map') {
            contextPhotosForDetailNav = this.mapView.currentFilteredPhotosForMap;
        } else {
            const activeFilter = this.filterManager.getActiveFilter();
             contextPhotosForDetailNav = (activeFilter === 'all' || !activeFilter)
                ? [...this.allPhotos]
                : this.allPhotos.filter(photo => photo.animeFilterTag === activeFilter);
        }
        
        const currentIndexInContext = contextPhotosForDetailNav.findIndex(p => p.id === photoToDisplay.id);

        if (photoToDisplay.exif && photoToDisplay.exif.latitude && photoToDisplay.exif.longitude) {
            this.lastDetailPhotoLocation = [photoToDisplay.exif.latitude, photoToDisplay.exif.longitude];
        } else {
            this.lastDetailPhotoLocation = null;
        }
        
        this.currentView = 'detail';
        this.galleryView.hide();
        this.mapView.hide();
        this.detailView.displayPhotoDetail(photoToDisplay, contextPhotosForDetailNav, currentIndexInContext);
        this._updateHeaderAndControls();
    }

    // 指定された名前のビューにアプリケーションの表示を切り替えます。
    // ('gallery', 'map', または 'detail' - ただしdetailはopenDetailView経由が主)。
    // 関連するビューの表示/非表示を管理し、必要に応じてデータを更新します。
    // @param {string} viewName - 切り替え先のビューの名前 ('gallery' または 'map')。
    switchToView(viewName) {
        if (this.currentView === 'detail') {
            this.detailView.hideAndCleanup();
        }
        
        this.currentView = viewName;
        const activeFilter = this.filterManager.getActiveFilter();
        this.currentFilteredPhotos = (activeFilter === 'all' || !activeFilter)
            ? [...this.allPhotos]
            : this.allPhotos.filter(photo => photo.animeFilterTag === activeFilter);

        this.galleryView.hide();
        this.mapView.hide();
        this.detailView.hide();

        if (viewName === 'gallery') {
            this.dom.rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
            this.galleryView.displayPhotos(this.currentFilteredPhotos);
            this.galleryView.show();
        } else if (viewName === 'map') {
            this.dom.rightPaneHeaderTitle.textContent = '聖地マップ';
            this.mapView.initializeMap();
            const fitBounds = !this.lastDetailPhotoLocation;
            this.mapView.plotMarkers(
                this.currentFilteredPhotos.filter(p => p.exif && p.exif.latitude && p.exif.longitude),
                fitBounds,
                this.lastDetailPhotoLocation 
            );
            this.mapView.show();
            this.mapView.invalidateSize();
        }
        
        this._updateHeaderAndControls();
    }

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
        }
    }
}

// DOMコンテンツが完全に読み込まれた後にアプリケーションを初期化します。
document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoApp();
    app.init();
});
