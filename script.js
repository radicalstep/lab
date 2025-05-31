document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const filterList = document.getElementById('filter-list');
    const rightPaneHeaderTitle = document.getElementById('right-pane-header-title');
    const closeDetailViewButton = document.getElementById('close-detail-view-button');
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const detailViewContainer = document.getElementById('detail-view-container');
    const detailSingleImageView = document.getElementById('detail-single-image-view');
    const detailModalImage = document.getElementById('detail-modal-image');
    const detailSideBySideView = document.getElementById('detail-side-by-side-view');
    const detailSbsAnimeImage = document.getElementById('detail-sbs-anime-image');
    const detailSbsRealImage = document.getElementById('detail-sbs-real-image');
    const detailToggleComparisonButton = document.getElementById('detail-toggle-comparison-button');
    const detailTitle = document.getElementById('detail-title');
    const detailAnimeTitleDisplay = document.getElementById('detail-anime-title-display');
    const detailPhotoDescription = document.getElementById('detail-photo-description');
    const detailDatetimeOriginal = document.getElementById('detail-datetime-original');
    const detailMapElement = document.getElementById('detail-map-element');
    const detailStreetviewLink = document.getElementById('detail-streetview-link');

    let allPhotosData = [];
    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true;
    let isDetailSideBySideActive = false;
    let detailMap = null;
    let currentMapMarker = null;

    async function loadPhotoData() {
        try {
            const response = await fetch('photos.json'); // photos.json を読み込む
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allPhotosData = await response.json();
            initializeGallery(); // データ読み込み後にギャラリーを初期化
        } catch (error) {
            console.error("写真データの読み込みに失敗しました:", error);
            photoGalleryContainer.innerHTML = '<p style="color: red; text-align: center;">写真データの読み込みに失敗しました。</p>';
        }
    }

    function initializeGallery() {
        photoGalleryContainer.classList.add('active-content');
        displayPhotos(allPhotosData); // 読み込んだ全データで初期表示
    }

    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;

            const img = document.createElement('img');
            img.src = photo.realSrc; // サムネイルにも実写画像を使用
            img.alt = photo.title;

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `
                <span class="title">${photo.title}</span>
                <span class="anime-title">${photo.animeTitleDisplay}</span>
            `;

            tile.appendChild(img);
            tile.appendChild(infoDiv);
            photoGalleryContainer.appendChild(tile);
            tile.addEventListener('click', () => openDetailView(photo.id));
        });
    }

    // exif-js を使って実際にExif情報を読み取る関数
    async function fetchExifDataWithExifJS(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            // 同じサーバー内なので crossOrigin は通常不要だが、
            // ローカル開発環境や特定のサーバー設定では必要な場合があるため残しておく。
            // 問題があれば削除または 'use-credentials' などを試す。
            img.crossOrigin = "Anonymous";


            img.onload = function() {
                console.log("Image loaded for EXIF processing:", imageSrc);
                EXIF.getData(img, function() {
                    const tags = EXIF.getAllTags(this);
                    console.log("All EXIF tags for " + imageSrc + ":", tags);

                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lon = EXIF.getTag(this, "GPSLongitude");
                    const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                    const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
                    let dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal"); // "YYYY:MM:DD HH:MM:SS" 形式

                    let exifInfo = {
                        latitude: null,
                        longitude: null,
                        dateTimeOriginal: null,
                        error: null
                    };

                    if (lat && lon && latRef && lonRef && lat.length === 3 && lon.length === 3) {
                        exifInfo.latitude = convertDMSToDD(lat[0].valueOf(), lat[1].valueOf(), lat[2].valueOf(), latRef);
                        exifInfo.longitude = convertDMSToDD(lon[0].valueOf(), lon[1].valueOf(), lon[2].valueOf(), lonRef);
                    } else {
                        if (!exifInfo.error) exifInfo.error = "位置情報なし";
                        console.warn("GPS Data not found or incomplete for " + imageSrc, {lat, lon, latRef, lonRef});
                    }

                    if (dateTimeOriginal) {
                        const parts = dateTimeOriginal.split(" ");
                        if (parts.length === 2) {
                            const dateParts = parts[0].split(":");
                            if (dateParts.length === 3) {
                                exifInfo.dateTimeOriginal = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T${parts[1]}`;
                            } else {
                                console.warn("DateTimeOriginal date part format is incorrect for " + imageSrc + ": " + parts[0]);
                                if (!exifInfo.error) exifInfo.error = "日時形式不正";
                            }
                        } else {
                             console.warn("DateTimeOriginal format is incorrect for " + imageSrc + ": " + dateTimeOriginal);
                             if (!exifInfo.error) exifInfo.error = "日時形式不正";
                        }
                    } else {
                        console.warn("DateTimeOriginal not found for " + imageSrc);
                    }
                    
                    resolve(exifInfo);
                });
            };

            img.onerror = function() {
                console.error("画像の読み込みに失敗しました (img.onerror):", imageSrc);
                resolve({ latitude: null, longitude: null, dateTimeOriginal: null, error: "画像読み込み失敗" });
            }
            img.src = imageSrc;
        });
    }

    // DMS (度分秒) 形式を DD (十進度) 形式に変換するヘルパー関数
    function convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / (60 * 60);
        if (direction == "S" || direction == "W") {
            dd = dd * -1;
        }
        return dd;
    }

    async function openDetailView(photoId) {
        currentPhotoData = allPhotosData.find(p => p.id === parseInt(photoId));
        if (!currentPhotoData) return;

        photoGalleryContainer.classList.remove('active-content');
        detailViewContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = currentPhotoData.title;
        closeDetailViewButton.style.display = 'inline-block';

        isRealImageDisplayedInSingleView = true;
        detailModalImage.src = currentPhotoData.realSrc;
        detailSbsAnimeImage.src = currentPhotoData.animeSrc;
        detailSbsRealImage.src = currentPhotoData.realSrc;
        switchToDetailSingleView();

        detailTitle.textContent = currentPhotoData.title;
        detailAnimeTitleDisplay.textContent = `アニメ: ${currentPhotoData.animeTitleDisplay}`;
        detailPhotoDescription.textContent = currentPhotoData.description;

        detailMapElement.innerHTML = '<p style="text-align:center; padding-top: 20px; color: #777;">位置情報を読み込み中...</p>';
        detailStreetviewLink.style.display = 'none';
        detailDatetimeOriginal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 日時情報読み込み中...';

        const exifInfo = await fetchExifDataWithExifJS(currentPhotoData.realSrc);

        let mapErrorMessage = exifInfo.error || "位置情報はありません。";

        if (exifInfo.latitude && exifInfo.longitude) {
            detailMapElement.innerHTML = ''; // ローディングメッセージをクリア
            setupMap(exifInfo.latitude, exifInfo.longitude, currentPhotoData.title);
            const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${exifInfo.latitude},${exifInfo.longitude}`;
            detailStreetviewLink.href = streetViewUrl;
            detailStreetviewLink.style.display = 'inline-block';
            detailStreetviewLink.innerHTML = `<i class="fas fa-street-view"></i> 「${currentPhotoData.title}」をストリートビューで見る`;
        } else {
            detailMapElement.innerHTML = `<p style="text-align:center; padding-top: 20px; color: #777;">${mapErrorMessage}</p>`;
             if(detailMap && currentMapMarker) {
                detailMap.removeLayer(currentMapMarker);
                currentMapMarker = null;
            }
        }

        if (exifInfo.dateTimeOriginal) {
            try {
                const date = new Date(exifInfo.dateTimeOriginal);
                if (isNaN(date.getTime())) { // Dateオブジェクトが有効かチェック
                    throw new Error("Invalid date object");
                }
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' };
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${date.toLocaleString('ja-JP', options)}`;
            } catch(e) {
                console.error("Error formatting dateTimeOriginal:", e, exifInfo.dateTimeOriginal);
                detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時: ${exifInfo.dateTimeOriginal || '取得エラー'} (書式エラーの可能性あり)`;
            }
        } else if (exifInfo.error) {
             detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 日時情報: ${exifInfo.error}`;
        }
         else {
            detailDatetimeOriginal.innerHTML = `<i class="far fa-calendar-alt"></i> 撮影日時情報はありません。`;
        }
    }

    function setupMap(lat, lon, title) {
        if (!detailMap) {
            detailMap = L.map(detailMapElement, { attributionControl: false }) // attributionを後から追加
                         .setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                // attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' // ここでは削除
            }).addTo(detailMap);
            L.control.attribution({prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(detailMap);

        } else {
            detailMap.setView([lat, lon], 15);
        }

        if (currentMapMarker) {
            detailMap.removeLayer(currentMapMarker);
        }
        currentMapMarker = L.marker([lat, lon]).addTo(detailMap)
            .bindPopup(title || '撮影場所')
            .openPopup();
        
        setTimeout(() => {
            if (detailMap && detailViewContainer.classList.contains('active-content')) {
                detailMap.invalidateSize();
            }
        }, 100); 
    }

    function closeDetailView() {
        detailViewContainer.classList.remove('active-content');
        photoGalleryContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
        closeDetailViewButton.style.display = 'none';
        currentPhotoData = null;
        if (detailMap && currentMapMarker) {
            detailMap.removeLayer(currentMapMarker);
            currentMapMarker = null;
        }
    }
    closeDetailViewButton.addEventListener('click', closeDetailView);

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
        if (!currentPhotoData || isDetailSideBySideActive) return;
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
            if (detailViewContainer.classList.contains('active-content')) {
                closeDetailView();
            }
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');
            const filterType = event.target.dataset.filter;
            let filteredPhotos;
            if (filterType === 'all') {
                filteredPhotos = allPhotosData;
            } else {
                filteredPhotos = allPhotosData.filter(photo => photo.animeFilterTag === filterType);
            }
            displayPhotos(filteredPhotos);
        }
    });

    loadPhotoData();
});
