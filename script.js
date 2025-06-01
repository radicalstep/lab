document.addEventListener('DOMContentLoaded', () => {
    const filterList = document.getElementById('filter-list');
    const rightPaneHeaderTitle = document.getElementById('right-pane-header-title');
    const closeDetailViewButton = document.getElementById('close-detail-view-button');
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

    let allPhotosData = [];
    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true;
    let isDetailSideBySideActive = false;
    let detailMap = null;
    let currentMapMarker = null;
    let currentFilteredPhotosForDetailView = [];
    let currentPhotoIndexInDetail = -1; // ★追加: 詳細ビューでの現在の写真のインデックス

    async function loadPhotoData() {
        try {
            const response = await fetch('photos.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allPhotosData = await response.json();
            populateFilters();
            currentFilteredPhotosForDetailView = [...allPhotosData];
            initializeGallery();
        } catch (error) {
            console.error("写真データの読み込みに失敗しました:", error);
            photoGalleryContainer.innerHTML = '<p style="color: red; text-align: center;">写真データの読み込みに失敗しました。photos.jsonを確認してください。</p>';
        }
    }

    function populateFilters() {
        // ... (変更なし) ...
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

    function initializeGallery() {
        photoGalleryContainer.classList.add('active-content');
        detailViewContainer.classList.remove('active-content');
        displayPhotos(allPhotosData);
    }

    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        currentFilteredPhotosForDetailView = [...photosToDisplay];
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
        // ... (変更なし) ...
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
                resolve({ latitude: null, longitude: null, dateTimeOriginal: null, error: "画像読み込み失敗" });
            }
            img.src = imageSrc;
        });
    }

    function convertDMSToDD(degrees, minutes, seconds, direction) {
        // ... (変更なし) ...
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction == "S" || direction == "W") { dd = dd * -1; }
        return dd;
    }

    async function openDetailView(photoId) {
        const newPhotoId = parseInt(photoId);
        currentPhotoData = allPhotosData.find(p => p.id === newPhotoId);
        if (!currentPhotoData) return;

        // ★変更: 現在の写真のインデックスを更新
        currentPhotoIndexInDetail = currentFilteredPhotosForDetailView.findIndex(p => p.id === newPhotoId);

        if (!detailViewContainer.classList.contains('active-content')) {
            photoGalleryContainer.classList.remove('active-content');
            detailViewContainer.classList.add('active-content');
            closeDetailViewButton.style.display = 'inline-block';
        }
        rightPaneHeaderTitle.textContent = currentPhotoData.title;

        // ... (残りの詳細情報設定は変更なし) ...
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

        if (detailMap) {
            detailMap.remove();
            detailMap = null;
        }
        currentMapMarker = null;

        const exifInfo = await fetchExifDataWithExifJS(currentPhotoData.realSrc);
        let mapErrorMessage = exifInfo.error || "位置情報はありません。";

        if (exifInfo.latitude && exifInfo.longitude) {
            requestAnimationFrame(() => {
                setupMap(exifInfo.latitude, exifInfo.longitude, currentPhotoData.title);
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
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラー)`;
            }
        } else if (exifInfo.error && exifInfo.error.includes("日時情報")) {
             detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        } else {
            detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }

        populateDetailThumbnails(newPhotoId);
    }

    function setupMap(lat, lon, title) {
        // ... (変更なし) ...
        detailMapElement.innerHTML = '';
        detailMap = L.map(detailMapElement, { attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(detailMap);
        L.control.attribution({prefix: '<a href="https://leafletjs.com" target="_blank">Leaflet</a> | © <a href="http://osm.org/copyright" target="_blank">OSM</a>'}).addTo(detailMap);
        currentMapMarker = L.marker([lat, lon]).addTo(detailMap).bindPopup(title || '撮影場所');
        detailMap.setView([lat, lon], 12);
        detailMap.invalidateSize();
        currentMapMarker.openPopup();
    }

    function closeDetailView() {
        // ... (変更なし) ...
        detailViewContainer.classList.remove('active-content');
        photoGalleryContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
        closeDetailViewButton.style.display = 'none';
        currentPhotoData = null;
        currentPhotoIndexInDetail = -1; // ★リセット
        if (detailMap) {
            detailMap.remove();
            detailMap = null;
        }
        currentMapMarker = null;
        detailThumbnailList.innerHTML = '';
    }
    closeDetailViewButton.addEventListener('click', closeDetailView);

    function switchToDetailSingleView() {
        // ... (変更なし) ...
        detailSingleImageView.classList.add('active-detail-image-display');
        detailSideBySideView.classList.remove('active-detail-image-display');
        detailToggleComparisonButton.textContent = '左右で比較する';
        isDetailSideBySideActive = false;
    }

    function switchToDetailSideBySideView() {
        // ... (変更なし) ...
        detailSingleImageView.classList.remove('active-detail-image-display');
        detailSideBySideView.classList.add('active-detail-image-display');
        detailToggleComparisonButton.textContent = '1枚表示に戻す';
        isDetailSideBySideActive = true;
    }

    detailModalImage.addEventListener('click', () => {
        // ... (変更なし) ...
        if (!currentPhotoData || isDetailSideBySideActive) return;
        if (isRealImageDisplayedInSingleView) {
            detailModalImage.src = currentPhotoData.animeSrc;
        } else {
            detailModalImage.src = currentPhotoData.realSrc;
        }
        isRealImageDisplayedInSingleView = !isRealImageDisplayedInSingleView;
    });

    detailToggleComparisonButton.addEventListener('click', () => {
        // ... (変更なし) ...
        if (!currentPhotoData) return;
        if (isDetailSideBySideActive) {
            switchToDetailSingleView();
        } else {
            switchToDetailSideBySideView();
        }
    });

    filterList.addEventListener('click', (event) => {
        // ... (変更なし) ...
        if (event.target.tagName === 'LI') {
            if (detailViewContainer.classList.contains('active-content')) {
                closeDetailView();
            }
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');
            const filterType = event.target.dataset.filter;
            let filteredPhotos = (filterType === 'all') ? allPhotosData : allPhotosData.filter(photo => photo.animeFilterTag === filterType);
            displayPhotos(filteredPhotos);
        }
    });

    function populateDetailThumbnails(activePhotoId) {
        // ... (変更なし) ...
        detailThumbnailList.innerHTML = '';

        currentFilteredPhotosForDetailView.forEach(photo => {
            const thumbItem = document.createElement('div');
            thumbItem.classList.add('detail-thumbnail-item');
            thumbItem.dataset.photoId = photo.id;
            // ★追加: キーボード操作のために tabindex を設定
            thumbItem.setAttribute('tabindex', '0');


            const img = document.createElement('img');
            img.src = photo.realSrc;
            img.alt = photo.title;
            thumbItem.appendChild(img);

            if (photo.id === activePhotoId) {
                thumbItem.classList.add('active-thumbnail');
            }

            thumbItem.addEventListener('click', () => {
                if (photo.id !== currentPhotoData.id) {
                    openDetailView(photo.id);
                }
            });
            // ★追加: Enterキーでもクリックと同様の動作
            thumbItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // デフォルトの動作（あれば）を抑制
                    if (photo.id !== currentPhotoData.id) {
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

    // ★追加: キーボードナビゲーション処理
    document.addEventListener('keydown', (event) => {
        // 詳細ビューが表示されていない、または入力フィールドにフォーカスがある場合は何もしない
        if (!detailViewContainer.classList.contains('active-content') || 
            ['input', 'textarea'].includes(event.target.tagName.toLowerCase())) {
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
            if (currentPhotoIndexInDetail < currentFilteredPhotosForDetailView.length - 1) {
                newIndex = currentPhotoIndexInDetail + 1;
                navigated = true;
            }
        }

        if (navigated && newIndex !== currentPhotoIndexInDetail) {
            event.preventDefault(); // 矢印キーによるページのスクロールを防ぐ
            const nextPhotoId = currentFilteredPhotosForDetailView[newIndex].id;
            openDetailView(nextPhotoId);

            // 新しく選択されたサムネイルにフォーカスを当てる（オプション）
            const newActiveThumb = detailThumbnailList.querySelector(`.detail-thumbnail-item[data-photo-id="${nextPhotoId}"]`);
            if (newActiveThumb) {
                newActiveThumb.focus();
            }
        }
    });


    // ホイールナビゲーション関連の変数
    let canNavigateByWheel = true; // ホイールナビゲーションが可能かどうかのフラグ
    const WHEEL_NAVIGATION_COOLDOWN = 300; // ms, ナビゲーション後のクールダウンタイム (少し長めに設定)

    detailViewContainer.addEventListener('wheel', (event) => {
        // 詳細ビューが表示されていない場合は何もしない
        if (!detailViewContainer.classList.contains('active-content')) {
            return;
        }

        const target = event.target;
        const infoPane = document.getElementById('detail-view-info-pane');
        const photoDescription = document.getElementById('detail-photo-description');
        const thumbnailList = document.getElementById('detail-thumbnail-list');
        const mapElement = document.getElementById('detail-map-element');

        // textarea, thumbnail-list, map要素、またはLeafletのインタラクティブな要素上では
        // デフォルトのホイール動作を優先し、画像ナビゲーションを行わない
        if (photoDescription.contains(target) || 
            thumbnailList.contains(target) ||
            mapElement.contains(target) ||
            (target.closest && (
                target.closest('.leaflet-map-pane') || // 地図のタイルやマーカーなど
                target.closest('.leaflet-control')    // 地図のコントロール（ズームボタンなど）
            ))) {
            return;
        }

        // infoPane (情報表示ペイン) がスクロール可能な場合、そのスクロールを優先
        if (infoPane.contains(target) && infoPane.scrollHeight > infoPane.clientHeight) {
            const isScrollingUp = event.deltaY < 0;
            const isAtTop = infoPane.scrollTop === 0;
            const isAtBottom = infoPane.scrollTop >= (infoPane.scrollHeight - infoPane.clientHeight - 1); // -1 for safety

            if (isScrollingUp && !isAtTop) { // 上にスクロールしようとしていて、まだ上にスクロールできる
                return;
            }
            if (!isScrollingUp && !isAtBottom) { // 下にスクロールしようとしていて、まだ下にスクロールできる
                return;
            }
            // ここまで来た場合は、infoPaneはスクロール可能だが、既に端に達している
        }
        
        // Y軸方向のホイール移動がない場合は何もしない (例: 横スクロールのみのトラックパッド操作)
        if (event.deltaY === 0) {
            return;
        }

        // ナビゲーションクールダウン中なら、ページのスクロールだけを防いでリターン
        if (!canNavigateByWheel) {
            event.preventDefault();
            return;
        }
        
        // 上記の条件に当てはまらなければ、画像ナビゲーションを試みる
        let newIndex = currentPhotoIndexInDetail;
        let performNavigation = false;

        if (event.deltaY < 0) { // ホイールを上に回した場合 (前の画像へ)
            if (currentPhotoIndexInDetail > 0) {
                newIndex = currentPhotoIndexInDetail - 1;
                performNavigation = true;
            }
        } else if (event.deltaY > 0) { // ホイールを下に回した場合 (次の画像へ)
            if (currentPhotoIndexInDetail < currentFilteredPhotosForDetailView.length - 1) {
                newIndex = currentPhotoIndexInDetail + 1;
                performNavigation = true;
            }
        }

        if (performNavigation) {
            event.preventDefault(); // 画像ナビゲーションを行うので、ページのスクロールを防ぐ
            canNavigateByWheel = false; // ナビゲーション実行、クールダウン開始

            const nextPhotoId = currentFilteredPhotosForDetailView[newIndex].id;
            // openDetailView は async 関数なので Promise を返す
            openDetailView(nextPhotoId).then(() => {
                // openDetailView内でpopulateDetailThumbnailsが呼ばれ、
                // アクティブなサムネイルはscrollIntoViewされる。
                // マウス操作なので、キーボード操作時のような明示的なfocus()はここでは行わない。
            }).catch(error => {
                console.error("Error during wheel navigation:", error);
            }).finally(() => {
                // ナビゲーションが成功しても失敗しても、クールダウンタイマーを設定
                setTimeout(() => {
                    canNavigateByWheel = true; // クールダウン終了
                }, WHEEL_NAVIGATION_COOLDOWN);
            });
        }
        }, { passive: false });



    loadPhotoData();
});
